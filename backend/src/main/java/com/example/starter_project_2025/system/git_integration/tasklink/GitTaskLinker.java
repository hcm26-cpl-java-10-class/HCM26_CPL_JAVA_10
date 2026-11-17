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
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.tasklink.TaskKeyParser.Mention;
import com.example.starter_project_2025.system.git_integration.tasklink.TaskKeyParser.Source;
import com.example.starter_project_2025.system.git_integration.tasklink.event.BacklogGitLinkedEvent;
import com.example.starter_project_2025.system.project.sprint_backlog.key.BacklogTaskKeyService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

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
 * Never writes a task: its status follows the project workflow only (AC05).
 * Every run is its own transaction ({@code REQUIRES_NEW}, also correct when called from
 * an AFTER_COMMIT listener) and is idempotent; two runs on one source (listener and
 * sweeper) collide on a unique key and the loser re-runs and finds the work done.
 */
@Component
public class GitTaskLinker {

    private static final Set<BacklogReferenceStatus> RECHECKABLE =
            EnumSet.of(BacklogReferenceStatus.INVALID, BacklogReferenceStatus.OUTSIDE_PROJECT);

    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final BacklogReferenceRepository references;
    private final BacklogGitLinkRepository links;
    private final BacklogItemDirectory directory;
    private final ProjectScopeResolver scopes;
    private final BacklogTaskKeyService taskKeys;
    private final ApplicationEventPublisher publisher;
    private final Clock clock;
    private final TransactionTemplate requiresNew;

    public GitTaskLinker(GitCommitRepository commits, GitPullRequestRepository pullRequests,
                         BacklogReferenceRepository references, BacklogGitLinkRepository links,
                         BacklogItemDirectory directory, ProjectScopeResolver scopes, BacklogTaskKeyService taskKeys,
                         ApplicationEventPublisher publisher, @Qualifier("gitIntegrationClock") Clock clock,
                         PlatformTransactionManager transactionManager) {
        this.commits = commits;
        this.pullRequests = pullRequests;
        this.references = references;
        this.links = links;
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
            mentions.put(commit, TaskKeyParser.parse(commit.getMessage(), BacklogReferenceField.MESSAGE,
                    run.prefixesOf(commit.getTenantId())));
        }
        run.loadItems(mentions.entrySet().stream().collect(Collectors.groupingBy(entry -> entry.getKey().getTenantId(),
                Collectors.flatMapping(entry -> entry.getValue().stream().map(Mention::key), Collectors.toSet()))));

        int linked = 0;
        for (Map.Entry<GitCommit, List<Mention>> entry : mentions.entrySet()) {
            GitCommit commit = entry.getKey();
            Artifact artifact = new Artifact(GitArtifactType.COMMIT, commit.getId(), commit.getTenantId(),
                    commit.getProjectId(), commit.getRepositoryId(), commit.getCommittedAt());
            linked += apply(artifact, entry.getValue(), run, new HashMap<>());
        }
        return linked;
    }

    // ---- pull requests (title / body / branch can change: recomputed on every update) -------------

    public int linkPullRequest(Long pullRequestId) {
        if (pullRequestId == null) return 0;
        Integer linked = GitIngestionRetry.onConflict(() -> requiresNew.execute(status -> doLinkPullRequest(pullRequestId)));
        return linked == null ? 0 : linked;
    }

    private int doLinkPullRequest(Long id) {
        GitPullRequest pr = pullRequests.findById(id).orElse(null);
        if (pr == null) return 0;
        Run run = new Run();
        List<Mention> found = TaskKeyParser.parseAll(List.of(
                new Source(BacklogReferenceField.TITLE, pr.getTitle()),
                new Source(BacklogReferenceField.BRANCH, pr.getHeadRef()),
                new Source(BacklogReferenceField.BODY, pr.getBody())), run.prefixesOf(pr.getTenantId()));

        Set<String> wanted = found.isEmpty() ? Set.of(NO_KEY)
                : found.stream().map(Mention::key).collect(Collectors.toSet());
        Map<String, BacklogReference> existing = new HashMap<>();
        for (BacklogReference ref : references.findBySourceTypeAndSourceId(GitArtifactType.PULL_REQUEST, id)) {
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
        return apply(artifact, found, run, existing);
    }

    // ---- re-check (D11): INVALID / OUTSIDE_PROJECT references judged again on request ---------------

    public RecheckResult recheck(Long repositoryId) {
        RecheckResult result = GitIngestionRetry.onConflict(() -> requiresNew.execute(status -> doRecheck(repositoryId)));
        return result == null ? new RecheckResult(0, 0) : result;
    }

    private RecheckResult doRecheck(Long repositoryId) {
        List<BacklogReference> refs = references.findByRepositoryIdAndStatusIn(repositoryId, RECHECKABLE);
        if (refs.isEmpty()) return new RecheckResult(0, 0);
        Run run = new Run();
        run.loadItems(refs.stream().collect(Collectors.groupingBy(BacklogReference::getTenantId,
                Collectors.mapping(BacklogReference::getRefKey, Collectors.toSet()))));
        Map<Long, LocalDateTime> commitTimes = commits.findAllById(idsOf(refs, GitArtifactType.COMMIT)).stream()
                .collect(Collectors.toMap(GitCommit::getId, GitCommit::getCommittedAt));
        Map<Long, LocalDateTime> prTimes = pullRequests.findAllById(idsOf(refs, GitArtifactType.PULL_REQUEST)).stream()
                .collect(Collectors.toMap(GitPullRequest::getId, GitPullRequest::getGithubCreatedAt));

        LocalDateTime now = LocalDateTime.now(clock);
        int nowLinked = 0;
        for (BacklogReference ref : refs) {
            LocalDateTime at = (ref.getSourceType() == GitArtifactType.COMMIT ? commitTimes : prTimes).get(ref.getSourceId());
            if (at == null) continue; // the commit / pull request no longer exists
            Artifact artifact = new Artifact(ref.getSourceType(), ref.getSourceId(), ref.getTenantId(), ref.getProjectId(),
                    ref.getRepositoryId(), at);
            Verdict verdict = decide(run.item(ref.getTenantId(), ref.getRefKey()), ref.getTenantId(), run.scopeOf(ref.getProjectId()));
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
    private int apply(Artifact artifact, List<Mention> found, Run run, Map<String, BacklogReference> existing) {
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
            Verdict verdict = decide(run.item(artifact.tenantId(), mention.key()), artifact.tenantId(), scope);
            fill(ref, verdict, now);
            ref = references.save(ref);
            if (reconcileLink(ref, artifact, verdict, now)) newlyLinked.add(verdict.itemId());
        }
        if (!newlyLinked.isEmpty()) publishLinked(artifact, newlyLinked);
        return newlyLinked.size();
    }

    /** D6: found and active in the tenant, then inside the master project's tree. */
    Verdict decide(BacklogItemRow item, Long tenantId, Set<Long> scope) {
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
        return new Verdict(BacklogReferenceStatus.LINKED, BacklogReferenceReason.OK, item.getId(), projectId);
    }

    /** Makes the automatic link match the verdict; true when a link was created. */
    private boolean reconcileLink(BacklogReference ref, Artifact artifact, Verdict verdict, LocalDateTime now) {
        if (verdict.status() != BacklogReferenceStatus.LINKED) {
            if (ref.getId() != null) links.deleteByReference(ref.getId(), BacklogLinkSource.AUTO);
            return false;
        }
        if (links.findByBacklogItemIdAndArtifactTypeAndArtifactId(verdict.itemId(), artifact.type(), artifact.id()).isPresent()) {
            return false;
        }
        links.save(BacklogGitLink.builder()
                .tenantId(artifact.tenantId())
                .projectId(artifact.projectId())
                .repositoryId(artifact.repositoryId())
                .backlogItemId(verdict.itemId())
                .itemProjectId(verdict.itemProjectId())
                .artifactType(artifact.type())
                .artifactId(artifact.id())
                .artifactAt(artifact.at() == null ? now : artifact.at())
                .linkSource(BacklogLinkSource.AUTO)
                .referenceId(ref.getId())
                .linkedAt(now)
                .build());
        return true;
    }

    private BacklogReference newReference(Artifact artifact, String key, String raw, BacklogReferenceField field) {
        return BacklogReference.builder()
                .tenantId(artifact.tenantId())
                .projectId(artifact.projectId())
                .repositoryId(artifact.repositoryId())
                .sourceType(artifact.type())
                .sourceId(artifact.id())
                .sourceField(field)
                .refKey(key)
                .rawText(raw)
                .build();
    }

    private static void fill(BacklogReference ref, Verdict verdict, LocalDateTime now) {
        ref.setStatus(verdict.status());
        ref.setReason(verdict.reason());
        ref.setBacklogItemId(verdict.itemId());
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
            return prefixes.computeIfAbsent(tenantId, id -> Set.copyOf(taskKeys.prefixesOf(id)));
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
}
