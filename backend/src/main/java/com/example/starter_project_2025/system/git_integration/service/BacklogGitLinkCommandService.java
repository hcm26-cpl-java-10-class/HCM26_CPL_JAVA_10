package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLink;
import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLinkExclusion;
import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceReason;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.dto.LinkPullRequestRequest;
import com.example.starter_project_2025.system.git_integration.dto.LinkedPullRequestItem;
import com.example.starter_project_2025.system.git_integration.dto.PullRequestCandidate;
import com.example.starter_project_2025.system.git_integration.dto.UpdateGitLinkRequest;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.ingestion.event.GitSourceChangedEvent;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkExclusionRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.tasklink.BacklogItemDirectory;
import com.example.starter_project_2025.system.git_integration.tasklink.GitTaskLinker;
import com.example.starter_project_2025.system.git_integration.tasklink.ProjectScopeResolver;
import com.example.starter_project_2025.system.git_integration.tasklink.event.BacklogGitLinkedEvent;
import com.example.starter_project_2025.system.git_integration.tasklink.event.BacklogGitUnlinkedEvent;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * TM-03: manual task ↔ pull request links, made from Task Detail.
 * <ul>
 *     <li><b>link</b>: a pull request of the task's repository, by number. An AUTO link of
 *     the pair is pinned (turned MANUAL); a MANUAL one is left as it is (idempotent).</li>
 *     <li><b>pin</b>: an AUTO link becomes MANUAL, so editing the Task ID out of the pull
 *     request no longer removes it.</li>
 *     <li><b>unlink</b>: removes the link and remembers the pair, so automatic mapping does
 *     not link it again while the pull request still names the Task ID.</li>
 * </ul>
 * Same rule as automatic mapping: an active task of the repository's master project or one
 * of its modules. Each change locks the pull request row, like {@code GitTaskLinker}, so the
 * two never interleave. Nothing here writes the task (its status follows the workflow only).
 */
@Service
public class BacklogGitLinkCommandService {
    @Autowired
    private GitEntityReferences entityReferences;

    static final int MAX_CANDIDATES = 10;
    static final int MAX_LINKED_KEYS = 3;

    private final BacklogItemDirectory directory;
    private final BacklogGitLinkRepository links;
    private final BacklogGitLinkExclusionRepository exclusions;
    private final BacklogReferenceRepository references;
    private final GitPullRequestRepository pullRequests;
    private final ProjectScopeResolver scopes;
    private final GitIntegrationAccessService access;
    private final BacklogGitLinkService queries;
    private final GitTaskLinker linker;
    private final ApplicationEventPublisher publisher;
    private final Clock clock;
    private final TransactionTemplate requiresNew;

    public BacklogGitLinkCommandService(BacklogItemDirectory directory, BacklogGitLinkRepository links,
                                        BacklogGitLinkExclusionRepository exclusions, BacklogReferenceRepository references,
                                        GitPullRequestRepository pullRequests, ProjectScopeResolver scopes,
                                        GitIntegrationAccessService access, BacklogGitLinkService queries, GitTaskLinker linker,
                                        ApplicationEventPublisher publisher, @Qualifier("gitIntegrationClock") Clock clock,
                                        PlatformTransactionManager transactionManager) {
        this.directory = directory;
        this.links = links;
        this.exclusions = exclusions;
        this.references = references;
        this.pullRequests = pullRequests;
        this.scopes = scopes;
        this.access = access;
        this.queries = queries;
        this.linker = linker;
        this.publisher = publisher;
        this.clock = clock;
        this.requiresNew = new TransactionTemplate(transactionManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** The link and whether this call created it (201) rather than pinning or finding it (200). */
    public record LinkResult(LinkedPullRequestItem item, boolean created) {
    }

    public LinkResult link(Long itemId, LinkPullRequestRequest request) {
        if (request.type() != GitArtifactType.PULL_REQUEST) throw GitIntegrationException.taskLinkTypeNotSupported();
        User user = access.requireUser();
        BacklogItemRow item = directory.requireUpdatable(itemId);
        if (!Boolean.TRUE.equals(item.getIsActive())) throw GitIntegrationException.taskInactive();
        Long itemProjectId = directory.projectOf(item);
        GitRepository repository = queries.repositoryOfTask(itemProjectId)
                .orElseThrow(GitIntegrationException::repositoryNotLinked);
        GitPullRequest pr = pullRequests.findByRepository_IdAndNumber(repository.getId(), request.number())
                .orElseThrow(GitIntegrationException::pullRequestNotFound);
        if (!scopes.scope(pr.getProjectId()).contains(itemProjectId)) throw GitIntegrationException.taskOutsideProject();
        return pinOrCreate(user, item, itemProjectId, pr.getId());
    }

    public LinkedPullRequestItem update(Long itemId, Long linkId, UpdateGitLinkRequest request) {
        if (request.source() != BacklogLinkSource.MANUAL) {
            throw new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_TASK_LINK_SOURCE_INVALID",
                    "Chỉ chuyển được liên kết sang MANUAL");
        }
        User user = access.requireUser();
        BacklogItemRow item = directory.requireUpdatable(itemId);
        BacklogGitLink link = requireLink(itemId, linkId);
        return pinOrCreate(user, item, link.getItemProjectId(), link.getArtifactId()).item();
    }

    public void unlink(Long itemId, Long linkId) {
        User user = access.requireUser();
        directory.requireUpdatable(itemId);
        Long prId = requireLink(itemId, linkId).getArtifactId();
        GitIngestionRetry.onConflict(() -> requiresNew.execute(status -> {
            GitPullRequest pr = pullRequests.lockById(prId).orElseThrow(GitIntegrationException::pullRequestNotFound);
            BacklogGitLink link = links.findByIdAndBacklogItem_Id(linkId, itemId)
                    .orElseThrow(GitIntegrationException::taskLinkNotFound);
            links.delete(link);
            LocalDateTime now = LocalDateTime.now(clock);
            if (exclusions.findByBacklogItem_IdAndArtifactTypeAndArtifact_Id(itemId, GitArtifactType.PULL_REQUEST, prId).isEmpty()) {
                exclusions.save(BacklogGitLinkExclusion.builder()
                        .tenant(entityReferences.get(Tenant.class, pr.getTenantId())).backlogItem(entityReferences.get(SprintBacklog.class, itemId))
                        .artifactType(GitArtifactType.PULL_REQUEST).artifact(entityReferences.artifact(GitArtifactType.PULL_REQUEST, prId))
                        .excludedByUser(entityReferences.get(User.class, user.getId())).excludedAt(now).build());
            }
            for (BacklogReference ref : referencesOf(prId, itemId)) {
                ref.setStatus(BacklogReferenceStatus.EXCLUDED);
                ref.setReason(BacklogReferenceReason.UNLINKED_BY_USER);
                ref.setResolvedAt(now);
            }
            publisher.publishEvent(new BacklogGitUnlinkedEvent(pr.getTenantId(), pr.getProjectId(), pr.getRepositoryId(),
                    GitArtifactType.PULL_REQUEST, prId, itemId, user.getId()));
            linker.syncMergeCommit(pr);
            return null;
        }));
    }

    /** Pull requests of the task's repository for the link picker: {@code #45}, {@code 45} or part of the title. */
    public List<PullRequestCandidate> candidates(Long itemId, String q) {
        BacklogItemRow item = directory.requireReadable(itemId);
        GitRepository repository = queries.repositoryOfTask(directory.projectOf(item)).orElse(null);
        if (repository == null) return List.of();

        String text = q == null ? "" : q.trim().replaceFirst("^#", "").trim().toLowerCase(Locale.ROOT);
        Integer number = text.matches("[0-9]{1,9}") ? Integer.valueOf(text) : null;
        String pattern = "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        List<GitPullRequest> found = pullRequests.search(repository.getId(), pattern, number, PageRequest.of(0, MAX_CANDIDATES));
        if (found.isEmpty()) return List.of();

        Map<Long, List<BacklogGitLink>> linksByPr = links.findByArtifactTypeAndArtifact_IdIn(GitArtifactType.PULL_REQUEST,
                found.stream().map(GitPullRequest::getId).toList()).stream()
                .collect(Collectors.groupingBy(BacklogGitLink::getArtifactId));
        Set<Long> otherItemIds = linksByPr.values().stream().flatMap(List::stream)
                .map(BacklogGitLink::getBacklogItemId).filter(id -> !id.equals(itemId)).collect(Collectors.toSet());
        Set<Long> visible = otherItemIds.isEmpty() ? Set.of() : directory.readable(otherItemIds);
        Map<Long, BacklogItemRow> others = directory.byIds(visible);

        return found.stream().map(pr -> {
            List<BacklogGitLink> prLinks = linksByPr.getOrDefault(pr.getId(), List.of());
            boolean alreadyLinked = prLinks.stream().anyMatch(link -> link.getBacklogItemId().equals(itemId));
            List<String> keys = prLinks.stream().map(link -> others.get(link.getBacklogItemId())).filter(Objects::nonNull)
                    .map(BacklogItemRow::getTaskKey).filter(Objects::nonNull).distinct().limit(MAX_LINKED_KEYS).toList();
            return new PullRequestCandidate(pr.getId(), pr.getNumber(), pr.getTitle(), pr.getState(),
                    Boolean.TRUE.equals(pr.getDraft()), pr.getAuthorLogin(), pr.getGithubUpdatedAt(), alreadyLinked, keys);
        }).toList();
    }

    // ---- shared ---------------------------------------------------------------------------------------

    private LinkResult pinOrCreate(User user, BacklogItemRow item, Long itemProjectId, Long prId) {
        Long itemId = item.getId();
        LinkResult result = GitIngestionRetry.onConflict(() -> requiresNew.execute(status -> {
            GitPullRequest pr = pullRequests.lockById(prId).orElseThrow(GitIntegrationException::pullRequestNotFound);
            exclusions.deletePair(itemId, GitArtifactType.PULL_REQUEST, prId);
            LocalDateTime now = LocalDateTime.now(clock);
            BacklogGitLink link = links.findByBacklogItem_IdAndArtifactTypeAndArtifact_Id(itemId, GitArtifactType.PULL_REQUEST, prId)
                    .orElse(null);
            boolean created = link == null;
            if (created) {
                link = links.save(BacklogGitLink.builder()
                        .tenant(entityReferences.get(Tenant.class, pr.getTenantId()))
                        .project(entityReferences.get(Project.class, pr.getProjectId()))
                        .repository(entityReferences.get(GitRepository.class, pr.getRepositoryId()))
                        .backlogItem(entityReferences.get(SprintBacklog.class, itemId))
                        .itemProject(entityReferences.get(Project.class, itemProjectId))
                        .artifactType(GitArtifactType.PULL_REQUEST).artifact(entityReferences.artifact(GitArtifactType.PULL_REQUEST, prId))
                        .artifactAt(pr.getGithubCreatedAt() == null ? now : pr.getGithubCreatedAt())
                        .linkSource(BacklogLinkSource.MANUAL)
                        .linkedByUser(entityReferences.get(User.class, user.getId()))
                        .linkedAt(now)
                        .build());
            } else if (link.getLinkSource() == BacklogLinkSource.AUTO) {
                // Pinned: no longer tied to the reference, so removing the Task ID from the pull request keeps it.
                link.confirmManual(user, now);
                link = links.save(link);
            }
            for (BacklogReference ref : referencesOf(prId, itemId)) {
                if (ref.getStatus() == BacklogReferenceStatus.EXCLUDED) {
                    ref.setStatus(BacklogReferenceStatus.LINKED);
                    ref.setReason(BacklogReferenceReason.OK);
                    ref.setResolvedAt(now);
                }
            }
            if (created) {
                publisher.publishEvent(new BacklogGitLinkedEvent(pr.getTenantId(), pr.getProjectId(), pr.getRepositoryId(),
                        GitArtifactType.PULL_REQUEST, prId, List.of(itemId)));
                linker.syncMergeCommit(pr);
            }
            publisher.publishEvent(new GitSourceChangedEvent(pr.getRepositoryId()));
            return new LinkResult(queries.linkedPullRequests(List.of(link)).get(0), created);
        }));
        return Objects.requireNonNull(result);
    }

    private BacklogGitLink requireLink(Long itemId, Long linkId) {
        BacklogGitLink link = links.findByIdAndBacklogItem_Id(linkId, itemId).orElseThrow(GitIntegrationException::taskLinkNotFound);
        if (link.getArtifactType() != GitArtifactType.PULL_REQUEST) throw GitIntegrationException.taskLinkTypeNotSupported();
        return link;
    }

    private List<BacklogReference> referencesOf(Long prId, Long itemId) {
        return references.findBySourceTypeAndSource_Id(GitArtifactType.PULL_REQUEST, prId).stream()
                .filter(ref -> itemId.equals(ref.getBacklogItemId()))
                .toList();
    }
}
