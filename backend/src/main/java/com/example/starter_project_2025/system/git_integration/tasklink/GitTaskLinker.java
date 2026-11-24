package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLink;
import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceReason;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.ingestion.event.GitSourceChangedEvent;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkExclusionRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.service.GitEntityReferences;
import com.example.starter_project_2025.system.git_integration.tasklink.TaskKeyParser.Mention;
import com.example.starter_project_2025.system.git_integration.tasklink.TaskKeyParser.Source;
import com.example.starter_project_2025.system.git_integration.tasklink.event.BacklogGitLinkedEvent;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.key.BacklogTaskKeyService;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import static com.example.starter_project_2025.system.git_integration.domain.BacklogReference.NO_KEY;

/**
 * SY-05: links commits and pull requests to the tasks whose Task IDs they mention.
 * <ol>
 *     <li>{@link TaskKeyParser} finds the Task IDs ({@code FA-21}).</li>
 *     <li>Each one is looked up by its stored key in the tenant and judged (D6):
 *     not found / deleted → INVALID, another project → OUTSIDE_PROJECT, the master
 *     project or one of its modules → LINKED. No Task ID at all → one MISSING row.</li>
 *     <li>{@code backlog_reference} keeps every verdict; {@code backlog_git_link} gets
 *     the LINKED ones.</li>
 * </ol>
 * TM-03: a pull request is read from its title and description only. MANUAL links are
 * never removed or changed here, and a pair a user unlinked ({@code backlog_git_link_exclusion})
 * is judged EXCLUDED instead of LINKED. The commit a pull request was merged with takes the
 * tasks the pull request is linked to ({@link #syncMergeCommit}), field MERGED_PR.
 * Never writes a task: its status follows the project workflow only (AC05).
 * Every run is its own transaction ({@code REQUIRES_NEW}, also correct when called from
 * an AFTER_COMMIT listener) and is idempotent; two runs on one source (listener and
 * sweeper) collide on a unique key and the loser re-runs and finds the work done.
 */
@Component
public class GitTaskLinker {
    @org.springframework.beans.factory.annotation.Autowired
    private com.example.starter_project_2025.system.project.developmentinsights.repository.GitDevelopmentRuleRepository developmentRules;
    @Autowired
    private GitEntityReferences entityReferences;

    private static final Set<BacklogReferenceStatus> RECHECKABLE =
            EnumSet.of(BacklogReferenceStatus.INVALID, BacklogReferenceStatus.OUTSIDE_PROJECT);

    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final BacklogReferenceRepository references;
    private final BacklogGitLinkRepository links;
    private final BacklogGitLinkExclusionRepository exclusions;
    private final BacklogItemDirectory directory;
    private final ProjectScopeResolver scopes;
    private final BacklogTaskKeyService taskKeys;
    private final ApplicationEventPublisher publisher;
    private final Clock clock;
    private final TransactionTemplate requiresNew;

    public GitTaskLinker(GitCommitRepository commits, GitPullRequestRepository pullRequests,
                         BacklogReferenceRepository references, BacklogGitLinkRepository links,
                         BacklogGitLinkExclusionRepository exclusions, BacklogItemDirectory directory, ProjectScopeResolver scopes, BacklogTaskKeyService taskKeys,
                         ApplicationEventPublisher publisher, @Qualifier("gitIntegrationClock") Clock clock,
                         PlatformTransactionManager transactionManager) {
        this.commits = commits;
        this.pullRequests = pullRequests;
        this.references = references;
        this.links = links;
        this.exclusions = exclusions;
        this.directory = directory;
        this.scopes = scopes;
        this.taskKeys = taskKeys;
        this.publisher = publisher;
        this.clock = clock;
        this.requiresNew = new TransactionTemplate(transactionManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Verdict on one Task ID. {@code itemId} is set for LINKED and OUTSIDE_PROJECT. */
    record Verdict(BacklogReferenceStatus status, BacklogReferenceReason reason, Long itemId, Long itemProjectId) {
    }

    /** The commit or pull request being processed. */
    private record Artifact(GitArtifactType type, Long id, Long tenantId, Long projectId, Long repositoryId,
                            LocalDateTime at) {
    }

    public record RecheckResult(int checked, int nowLinked) {
    }

    // ---- commits (immutable: processed once) -----------------------------------------------------

    /** Processes the commits not processed yet; returns how many links were created. */
    public int linkCommits(Collection<Long> commitIds) {
        if (commitIds == null || commitIds.isEmpty()) return 0;
        List<Long> ids = List.copyOf(new LinkedHashSet<>(commitIds));
        Integer linked = GitIngestionRetry.onConflict(() -> requiresNew.execute(status -> doLinkCommits(ids)));
        return linked == null ? 0 : linked;
    }

    private int doLinkCommits(List<Long> ids) {
        Set<Long> processed = new HashSet<>(references.findProcessedSourceIds(GitArtifactType.COMMIT, ids));
        List<GitCommit> pending = commits.findAllById(ids).stream()
                .filter(commit -> !processed.contains(commit.getId()))
                .sorted(Comparator.comparing(GitCommit::getId))
                .toList();
        if (pending.isEmpty()) return 0;

        Run run = new Run();
        Map<GitCommit, List<Mention>> mentions = new LinkedHashMap<>();
        for (GitCommit commit : pending) {
            mentions.put(commit, TaskKeyParser.parseAll(List.of(new Source(BacklogReferenceField.MESSAGE, commit.getMessage())),
                    run.prefixesOf(commit.getTenantId()), taskPattern(commit.getProjectId())));
        }
        run.loadItems(mentions.entrySet().stream().collect(Collectors.groupingBy(entry -> entry.getKey().getTenantId(),
                Collectors.flatMapping(entry -> entry.getValue().stream().map(Mention::key), Collectors.toSet()))));

        Map<String, List<GitPullRequest>> mergedBySha = pullRequests.findByStateAndMergeCommitShaIn(GitPullRequestState.MERGED,
                        pending.stream().map(GitCommit::getSha).filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.groupingBy(GitPullRequest::getMergeCommitSha));

        int linked = 0;
        for (Map.Entry<GitCommit, List<Mention>> entry : mentions.entrySet()) {
            GitCommit commit = entry.getKey();
            linked += apply(artifactOf(commit), entry.getValue(), run, new HashMap<>(), Set.of());
            for (GitPullRequest pr : mergedBySha.getOrDefault(commit.getSha(), List.of())) {
                if (Objects.equals(pr.getRepositoryId(), commit.getRepositoryId())) linked += inherit(commit, pr);
            }
        }
        return linked;
    }

    /**
     * TM-03: the commit a merged pull request was merged with (merge, squash or rebase) is
     * linked to the tasks the pull request is linked to, AUTO or MANUAL: GitHub writes only
     * the title into it, so a Task ID in the description would otherwise never reach it.
     * Follows the pull request (a task unlinked from it goes from the commit too). Runs in the
     * caller's transaction, which holds the pull request's lock; returns how many links are new.
     */
    public int syncMergeCommit(GitPullRequest pr) {
        if (pr.getState() != GitPullRequestState.MERGED || pr.getMergeCommitSha() == null) return 0;
        // Not stored yet: the push is processed later and inherits then.
        return commits.findFirstByRepository_IdAndSha(pr.getRepositoryId(), pr.getMergeCommitSha())
                .map(commit -> inherit(commit, pr))
                .orElse(0);
    }

    /**
     * Merge commits missing the tasks of their pull request: data from before TM-03 (at start-up)
     * or a re-check. {@code repositoryId} null = every repository. Returns how many links are new.
     */
    public int syncMergeCommits(Long repositoryId) {
        int linked = 0;
        for (Long id : pullRequests.findMergedWithoutInheritedLinks(repositoryId)) {
            Integer created = GitIngestionRetry.onConflict(() -> requiresNew.execute(status ->
                    pullRequests.lockById(id).map(this::syncMergeCommit).orElse(0)));
            linked += created == null ? 0 : created;
        }
        return linked;
    }

    private int inherit(GitCommit commit, GitPullRequest pr) {
        List<BacklogReference> refs = references.findBySourceTypeAndSource_Id(GitArtifactType.COMMIT, commit.getId());
        if (refs.isEmpty()) return 0; // not processed yet: linkCommits inherits when it processes it
        Map<String, BacklogReference> inherited = new HashMap<>();
        Set<String> named = new HashSet<>();
        for (BacklogReference ref : refs) {
            if (ref.getSourceField() == BacklogReferenceField.MERGED_PR) inherited.put(ref.getRefKey(), ref);
            else named.add(ref.getRefKey());
        }
        List<Long> itemIds = links.findByArtifactTypeAndArtifact_IdIn(GitArtifactType.PULL_REQUEST, List.of(pr.getId())).stream()
                .map(BacklogGitLink::getBacklogItemId).distinct().toList();
        Artifact artifact = artifactOf(commit);
        LocalDateTime now = LocalDateTime.now(clock);
        Set<String> wanted = new HashSet<>();
        List<Long> newlyLinked = new ArrayList<>();
        for (BacklogItemRow item : directory.byIds(itemIds).values().stream().sorted(Comparator.comparing(BacklogItemRow::getId)).toList()) {
            String key = item.getTaskKey();
            if (key == null || named.contains(key)) continue; // the message already names it
            wanted.add(key);
            BacklogReference ref = inherited.getOrDefault(key,
                    newReference(artifact, key, "#" + pr.getNumber(), BacklogReferenceField.MERGED_PR));
            Verdict verdict = new Verdict(BacklogReferenceStatus.LINKED, BacklogReferenceReason.OK, item.getId(),
                    directory.projectOf(item));
            fill(ref, verdict, now);
            ref = references.save(ref);
            if (reconcileLink(ref, artifact, verdict, now)) newlyLinked.add(item.getId());
        }
        for (BacklogReference stale : inherited.values()) {
            if (wanted.contains(stale.getRefKey())) continue;
            links.deleteByReference(stale.getId(), BacklogLinkSource.AUTO);
            references.delete(stale);
        }
        if (!newlyLinked.isEmpty()) publishLinked(artifact, newlyLinked);
        return newlyLinked.size();
    }

    private static Artifact artifactOf(GitCommit commit) {
        return new Artifact(GitArtifactType.COMMIT, commit.getId(), commit.getTenantId(),
                commit.getProjectId(), commit.getRepositoryId(), commit.getCommittedAt());
    }

    // ---- pull requests (title / description can change: recomputed on every update) ---------------

    public int linkPullRequest(Long pullRequestId) {
        if (pullRequestId == null) return 0;
        Integer linked = GitIngestionRetry.onConflict(() -> requiresNew.execute(status -> doLinkPullRequest(pullRequestId)));
        return linked == null ? 0 : linked;
    }

    private int doLinkPullRequest(Long id) {
        // Locked: a manual link / unlink of this pull request waits for this run, or this run for it.
        GitPullRequest pr = pullRequests.lockById(id).orElse(null);
        if (pr == null) return 0;
        String fingerprint = mappingFingerprint(pr);
        var storedReferences = references.findBySourceTypeAndSource_Id(GitArtifactType.PULL_REQUEST, id);
        if (fingerprint.equals(pr.getTaskMappingFingerprint()) && storedReferences.stream()
                .noneMatch(ref -> ref.getSourceField() == BacklogReferenceField.BRANCH)) return 0;
        Run run = new Run();
        // TM-03 BR1: the title, then the description. The branch name is not a source.
        List<Mention> found = TaskKeyParser.parseAll(List.of(
                new Source(BacklogReferenceField.TITLE, pr.getTitle()),
                new Source(BacklogReferenceField.BODY, pr.getBody())), run.prefixesOf(pr.getTenantId()), taskPattern(pr.getProjectId()));

        Set<String> wanted = found.isEmpty() ? Set.of(NO_KEY)
                : found.stream().map(Mention::key).collect(Collectors.toSet());
        Map<String, BacklogReference> existing = new HashMap<>();
        for (BacklogReference ref : storedReferences) {
            if (wanted.contains(ref.getRefKey())) {
                existing.put(ref.getRefKey(), ref);
            } else {
                // The Task ID was edited out of the title / body: its automatic link goes too.
                links.deleteByReference(ref.getId(), BacklogLinkSource.AUTO);
                references.delete(ref);
            }
        }
        references.flush();

        run.loadItems(Map.of(pr.getTenantId(), found.stream().map(Mention::key).collect(Collectors.toSet())));
        Artifact artifact = new Artifact(GitArtifactType.PULL_REQUEST, pr.getId(), pr.getTenantId(), pr.getProjectId(),
                pr.getRepositoryId(), pr.getGithubCreatedAt());
        int linked = apply(artifact, found, run, existing, exclusions.findExcludedItemIds(GitArtifactType.PULL_REQUEST, id));
        int inherited = syncMergeCommit(pr);
        pr.setTaskMappingFingerprint(fingerprint);
        publisher.publishEvent(new GitSourceChangedEvent(pr.getRepositoryId()));
        return linked + inherited;
    }

    // ---- re-check (D11): INVALID / OUTSIDE_PROJECT references judged again on request ---------------

    public RecheckResult recheck(Long repositoryId) {
        RecheckResult result = GitIngestionRetry.onConflict(() -> requiresNew.execute(status -> doRecheck(repositoryId)));
        int merged = syncMergeCommits(repositoryId);
        return result == null ? new RecheckResult(0, merged) : new RecheckResult(result.checked(), result.nowLinked() + merged);
    }

    private RecheckResult doRecheck(Long repositoryId) {
        List<BacklogReference> refs = references.findByRepository_IdAndStatusIn(repositoryId, RECHECKABLE);
        if (refs.isEmpty()) return new RecheckResult(0, 0);
        Run run = new Run();
        run.loadItems(refs.stream().collect(Collectors.groupingBy(BacklogReference::getTenantId,
                Collectors.mapping(BacklogReference::getRefKey, Collectors.toSet()))));
        Map<Long, LocalDateTime> commitTimes = commits.findAllById(idsOf(refs, GitArtifactType.COMMIT)).stream()
                .collect(Collectors.toMap(GitCommit::getId, GitCommit::getCommittedAt));
        Map<Long, LocalDateTime> prTimes = pullRequests.findAllById(idsOf(refs, GitArtifactType.PULL_REQUEST)).stream()
                .collect(Collectors.toMap(GitPullRequest::getId, GitPullRequest::getGithubCreatedAt));

        Map<Long, Set<Long>> excludedByPr = new HashMap<>();
        LocalDateTime now = LocalDateTime.now(clock);
        int nowLinked = 0;
        for (BacklogReference ref : refs) {
            LocalDateTime at = (ref.getSourceType() == GitArtifactType.COMMIT ? commitTimes : prTimes).get(ref.getSourceId());
            if (at == null) continue; // the commit / pull request no longer exists
            Artifact artifact = new Artifact(ref.getSourceType(), ref.getSourceId(), ref.getTenantId(), ref.getProjectId(),
                    ref.getRepositoryId(), at);
            Set<Long> excluded = ref.getSourceType() == GitArtifactType.PULL_REQUEST
                    ? excludedByPr.computeIfAbsent(ref.getSourceId(),
                    prId -> exclusions.findExcludedItemIds(GitArtifactType.PULL_REQUEST, prId))
                    : Set.of();
            Verdict verdict = decide(run.item(ref.getTenantId(), ref.getRefKey()), ref.getTenantId(),
                    run.scopeOf(ref.getProjectId()), excluded);
            fill(ref, verdict, now);
            references.save(ref);
            if (reconcileLink(ref, artifact, verdict, now)) {
                nowLinked++;
                publishLinked(artifact, List.of(verdict.itemId()));
            }
        }
        return new RecheckResult(refs.size(), nowLinked);
    }

    // ---- shared -------------------------------------------------------------------------------------

    /** Writes the references of one source and the links of the LINKED ones; returns how many links are new. */
    private int apply(Artifact artifact, List<Mention> found, Run run, Map<String, BacklogReference> existing,
                      Set<Long> excluded) {
        LocalDateTime now = LocalDateTime.now(clock);
        if (found.isEmpty()) {
            BacklogReference ref = existing.getOrDefault(NO_KEY, newReference(artifact, NO_KEY, null, BacklogReferenceField.NONE));
            fill(ref, new Verdict(BacklogReferenceStatus.MISSING, BacklogReferenceReason.NO_TASK_ID, null, null), now);
            references.save(ref);
            return 0;
        }
        Set<Long> scope = run.scopeOf(artifact.projectId());
        List<Long> newlyLinked = new ArrayList<>();
        for (Mention mention : found) {
            BacklogReference ref = existing.get(mention.key());
            if (ref == null) {
                ref = newReference(artifact, mention.key(), mention.raw(), mention.field());
            } else {
                ref.setRawText(mention.raw());
                ref.setSourceField(mention.field());
            }
            Verdict verdict = decide(run.item(artifact.tenantId(), mention.key()), artifact.tenantId(), scope, excluded);
            fill(ref, verdict, now);
            ref = references.save(ref);
            if (reconcileLink(ref, artifact, verdict, now)) newlyLinked.add(verdict.itemId());
        }
        if (!newlyLinked.isEmpty()) publishLinked(artifact, newlyLinked);
        return newlyLinked.size();
    }

    /**
     * D6: found and active in the tenant, then inside the master project's tree; TM-03: then
     * not unlinked by a user ({@code excluded} = task ids unlinked from this pull request).
     */
    Verdict decide(BacklogItemRow item, Long tenantId, Set<Long> scope, Set<Long> excluded) {
        if (item == null || !Objects.equals(item.getTenantId(), tenantId)) {
            return new Verdict(BacklogReferenceStatus.INVALID, BacklogReferenceReason.NOT_FOUND, null, null);
        }
        if (!Boolean.TRUE.equals(item.getIsActive())) {
            return new Verdict(BacklogReferenceStatus.INVALID, BacklogReferenceReason.DELETED, null, null);
        }
        Long projectId = directory.projectOf(item);
        if (projectId == null || !scope.contains(projectId)) {
            return new Verdict(BacklogReferenceStatus.OUTSIDE_PROJECT, BacklogReferenceReason.OTHER_PROJECT, item.getId(), projectId);
        }
        if (excluded.contains(item.getId())) {
            return new Verdict(BacklogReferenceStatus.EXCLUDED, BacklogReferenceReason.UNLINKED_BY_USER, item.getId(), projectId);
        }
        return new Verdict(BacklogReferenceStatus.LINKED, BacklogReferenceReason.OK, item.getId(), projectId);
    }

    /**
     * Makes the automatic link match the verdict; true when a link was created. Only AUTO
     * links are removed, and an existing link of the pair (AUTO or MANUAL) is left as it is.
     */
    private boolean reconcileLink(BacklogReference ref, Artifact artifact, Verdict verdict, LocalDateTime now) {
        if (verdict.status() != BacklogReferenceStatus.LINKED) {
            if (ref.getId() != null) links.deleteByReference(ref.getId(), BacklogLinkSource.AUTO);
            return false;
        }
        if (links.findByBacklogItem_IdAndArtifactTypeAndArtifact_Id(verdict.itemId(), artifact.type(), artifact.id()).isPresent()) {
            return false; // already linked, possibly manually (TM-03 BR7: never overwritten)
        }
        links.save(BacklogGitLink.builder()
                .tenant(entityReferences.get(Tenant.class, artifact.tenantId()))
                .project(entityReferences.get(Project.class, artifact.projectId()))
                .repository(entityReferences.get(GitRepository.class, artifact.repositoryId()))
                .backlogItem(entityReferences.get(SprintBacklog.class, verdict.itemId()))
                .itemProject(entityReferences.get(Project.class, verdict.itemProjectId()))
                .artifactType(artifact.type()).artifact(entityReferences.artifact(artifact.type(), artifact.id()))
                .artifactAt(artifact.at() == null ? now : artifact.at())
                .linkSource(BacklogLinkSource.AUTO)
                .reference(entityReferences.get(BacklogReference.class, ref.getId()))
                .linkedAt(now)
                .build());
        return true;
    }

    private BacklogReference newReference(Artifact artifact, String key, String raw, BacklogReferenceField field) {
        return BacklogReference.builder()
                .tenant(entityReferences.get(Tenant.class, artifact.tenantId()))
                .project(entityReferences.get(Project.class, artifact.projectId()))
                .repository(entityReferences.get(GitRepository.class, artifact.repositoryId()))
                .sourceType(artifact.type()).source(entityReferences.artifact(artifact.type(), artifact.id()))
                .sourceField(field)
                .refKey(key)
                .rawText(raw)
                .build();
    }

    private void fill(BacklogReference ref, Verdict verdict, LocalDateTime now) {
        ref.setStatus(verdict.status());
        ref.setReason(verdict.reason());
        ref.setBacklogItem(entityReferences.get(SprintBacklog.class, verdict.itemId()));
        ref.setResolvedAt(now);
    }

    private void publishLinked(Artifact artifact, List<Long> itemIds) {
        publisher.publishEvent(new BacklogGitLinkedEvent(artifact.tenantId(), artifact.projectId(), artifact.repositoryId(),
                artifact.type(), artifact.id(), List.copyOf(itemIds)));
    }

    private static List<Long> idsOf(List<BacklogReference> refs, GitArtifactType type) {
        return refs.stream().filter(ref -> ref.getSourceType() == type).map(BacklogReference::getSourceId).distinct().toList();
    }

    /** Lookups shared by one run: prefixes per tenant, scope per master, tasks by key. */
    private final class Run {
        private final Map<Long, Set<String>> prefixes = new HashMap<>();
        private final Map<Long, Set<Long>> scopeByMaster = new HashMap<>();
        private final Map<Long, Map<String, BacklogItemRow>> items = new HashMap<>();

        Set<String> prefixesOf(Long tenantId) {
            return prefixes.computeIfAbsent(tenantId, directory::prefixesOf);
        }

        Set<Long> scopeOf(Long masterId) {
            return scopeByMaster.computeIfAbsent(masterId, scopes::scope);
        }

        void loadItems(Map<Long, Set<String>> keysByTenant) {
            keysByTenant.forEach((tenantId, keys) -> items.computeIfAbsent(tenantId, id -> new HashMap<>())
                    .putAll(directory.byKeys(tenantId, keys.stream().filter(key -> !key.isEmpty()).toList())));
        }

        BacklogItemRow item(Long tenantId, String key) {
            return items.getOrDefault(tenantId, Map.of()).get(key);
        }
    }

    private String taskPattern(Long projectId) {
        return developmentRules.findAllByRootProject_IdOrderByTypeAscVersionDesc(projectId).stream()
                .filter(rule -> rule.getType() == com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType.TASK_ID)
                .findFirst().map(rule -> rule.getTaskKeyPattern()).orElse(null);
    }

    private static String mappingFingerprint(GitPullRequest pr) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            String snapshot = java.util.Objects.toString(pr.getTitle(), "") + "\u0000"
                    + java.util.Objects.toString(pr.getBody(), "") + "\u0000"
                    + pr.getState() + "\u0000" + java.util.Objects.toString(pr.getMergeCommitSha(), "");
            return java.util.HexFormat.of().formatHex(digest.digest(snapshot.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
