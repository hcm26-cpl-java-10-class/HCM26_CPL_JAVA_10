package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLink;
import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.dto.BacklogGitLinkInfo;
import com.example.starter_project_2025.system.git_integration.dto.BacklogGitLinkSummary;
import com.example.starter_project_2025.system.git_integration.dto.BacklogGitLinksView;
import com.example.starter_project_2025.system.git_integration.dto.GitCommitItem;
import com.example.starter_project_2025.system.git_integration.dto.GitPage;
import com.example.starter_project_2025.system.git_integration.dto.GitPullRequestItem;
import com.example.starter_project_2025.system.git_integration.dto.LinkedPullRequestItem;
import com.example.starter_project_2025.system.git_integration.dto.TaskLinkRecheckResult;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitProjectLookupRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.tasklink.BacklogItemDirectory;
import com.example.starter_project_2025.system.git_integration.tasklink.GitTaskLinkSweeper;
import com.example.starter_project_2025.system.git_integration.tasklink.GitTaskLinker;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * SY-05: the commits and pull requests of a task (Task Detail, AC01/AC02), link badges
 * for the boards, and the manager's re-check. Reading follows the task's own visibility.
 */
@Service
@RequiredArgsConstructor
public class BacklogGitLinkService {

    static final int MAX_PAGE_SIZE = 100;
    static final int MAX_SUMMARY_ITEMS = 500;

    private final BacklogItemDirectory directory;
    private final BacklogGitLinkRepository links;
    private final BacklogReferenceRepository references;
    private final UserRepository users;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final GitRepositoryRepository connections;
    private final GitProjectLookupRepository projects;
    private final GitProjectResolver projectResolver;
    private final GitIntegrationAccessService access;
    private final RepositoryActivityQueryService activity;
    private final GitTaskLinker linker;
    private final GitTaskLinkSweeper sweeper;

    @Transactional(readOnly = true)
    public BacklogGitLinksView itemLinks(Long itemId, int page, int size) {
        BacklogItemRow item = directory.requireReadable(itemId);
        int pageIndex = Math.max(page, 0);
        int pageSize = size < 1 ? 20 : Math.min(size, MAX_PAGE_SIZE);

        Page<BacklogGitLink> commitLinks = links.findByBacklogItemIdAndArtifactType(itemId, GitArtifactType.COMMIT,
                PageRequest.of(pageIndex, pageSize, Sort.by(Sort.Order.desc("artifactAt"), Sort.Order.desc("id"))));
        Map<Long, GitCommit> commitById = commits.findAllById(commitLinks.getContent().stream()
                .map(BacklogGitLink::getArtifactId).toList()).stream()
                .collect(Collectors.toMap(GitCommit::getId, Function.identity()));
        List<GitCommitItem> commitItems = commitLinks.getContent().stream()
                .map(link -> commitById.get(link.getArtifactId())).filter(Objects::nonNull)
                .map(commit -> RepositoryActivityQueryService.commitItem(commit, List.of()))
                .toList();

        List<BacklogGitLink> prLinks = links.findByBacklogItemIdAndArtifactTypeOrderByArtifactAtDescIdDesc(itemId,
                GitArtifactType.PULL_REQUEST);
        List<LinkedPullRequestItem> prItems = linkedPullRequests(prLinks);

        return new BacklogGitLinksView(item.getId(), item.getTaskKey(), repositoryOf(directory.projectOf(item)), prItems,
                new GitPage<>(commitItems, pageIndex, pageSize, commitLinks.getTotalElements(), commitLinks.getTotalPages()),
                commitLinks.getTotalElements(), prItems.size());
    }

    /** Link counts of the tasks of a board; tasks the caller cannot open are left out. */
    @Transactional(readOnly = true)
    public List<BacklogGitLinkSummary> summary(Collection<Long> itemIds) {
        List<Long> requested = itemIds == null ? List.of()
                : itemIds.stream().filter(Objects::nonNull).distinct().limit(MAX_SUMMARY_ITEMS).toList();
        if (requested.isEmpty()) return List.of();
        Set<Long> visible = directory.readable(requested);
        if (visible.isEmpty()) return List.of();

        Map<Long, long[]> counts = new HashMap<>();
        for (Object[] row : links.countByItems(visible)) {
            long[] pair = counts.computeIfAbsent((Long) row[0], id -> new long[2]);
            pair[row[1] == GitArtifactType.COMMIT ? 0 : 1] = (Long) row[2];
        }
        Map<Long, BacklogGitLink> latestPr = links.findByBacklogItemIdInAndArtifactType(visible, GitArtifactType.PULL_REQUEST)
                .stream().collect(Collectors.toMap(BacklogGitLink::getBacklogItemId, Function.identity(),
                        (a, b) -> Comparator.comparing(BacklogGitLink::getArtifactAt).thenComparing(BacklogGitLink::getId)
                                .compare(a, b) >= 0 ? a : b));
        Map<Long, GitPullRequest> prById = pullRequests.findAllById(latestPr.values().stream()
                .map(BacklogGitLink::getArtifactId).toList()).stream()
                .collect(Collectors.toMap(GitPullRequest::getId, Function.identity()));

        List<BacklogGitLinkSummary> result = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(requested)) {
            if (!visible.contains(id)) continue;
            long[] pair = counts.getOrDefault(id, new long[2]);
            BacklogGitLink link = latestPr.get(id);
            GitPullRequest pr = link == null ? null : prById.get(link.getArtifactId());
            result.add(new BacklogGitLinkSummary(id, pair[0], pair[1],
                    pr == null ? null : pr.getNumber(), pr == null ? null : pr.getState()));
        }
        return result;
    }

    /**
     * Manager action (D11): judges the INVALID / OUTSIDE_PROJECT references of the project's
     * repository again (a task restored or moved into the project becomes linked) and
     * processes any commit or pull request still waiting.
     */
    public TaskLinkRecheckResult recheck(Long projectId) {
        User user = access.requireUser();
        access.requireManage(user);
        GitRepository repository = activity.repositoryFor(projectId).orElseThrow(GitIntegrationException::repositoryNotLinked);
        int processed = sweeper.sweep(repository.getId());
        GitTaskLinker.RecheckResult result = linker.recheck(repository.getId());
        return new TaskLinkRecheckResult(result.checked(), result.nowLinked(), processed);
    }

    /** TM-03: the pull requests of the given links (in their order), each with how it was linked. */
    public List<LinkedPullRequestItem> linkedPullRequests(List<BacklogGitLink> prLinks) {
        if (prLinks.isEmpty()) return List.of();
        List<Long> ids = prLinks.stream().map(BacklogGitLink::getArtifactId).toList();
        Map<Long, GitPullRequest> byId = pullRequests.findAllById(ids).stream()
                .collect(Collectors.toMap(GitPullRequest::getId, Function.identity()));
        Map<Long, List<GitPullRequestReview>> reviewsByPr = reviews.findByPullRequestIdIn(ids).stream()
                .collect(Collectors.groupingBy(GitPullRequestReview::getPullRequestId));
        Map<Long, BacklogReference> referenceById = references.findAllById(prLinks.stream()
                        .map(BacklogGitLink::getReferenceId).filter(Objects::nonNull).toList()).stream()
                .collect(Collectors.toMap(BacklogReference::getId, Function.identity()));
        Map<Long, String> nameById = users.findAllById(prLinks.stream()
                        .map(BacklogGitLink::getLinkedByUserId).filter(Objects::nonNull).distinct().toList()).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));

        List<LinkedPullRequestItem> result = new ArrayList<>();
        for (BacklogGitLink link : prLinks) {
            GitPullRequest pr = byId.get(link.getArtifactId());
            if (pr == null) continue;
            BacklogReference ref = link.getReferenceId() == null ? null : referenceById.get(link.getReferenceId());
            GitPullRequestItem item = RepositoryActivityQueryService.pullRequestItem(pr,
                    reviewsByPr.getOrDefault(pr.getId(), List.of()), List.of());
            result.add(new LinkedPullRequestItem(item, new BacklogGitLinkInfo(link.getId(), link.getLinkSource(),
                    link.getLinkSource() == BacklogLinkSource.AUTO && ref != null ? ref.getSourceField() : null,
                    link.getLinkedByUserId(),
                    link.getLinkedByUserId() == null ? null : nameById.get(link.getLinkedByUserId()),
                    link.getLinkedAt())));
        }
        return result;
    }

    /** Repository of the task's master project: the ACTIVE connection, else the latest one. */
    public Optional<GitRepository> repositoryOfTask(Long projectId) {
        if (projectId == null) return Optional.empty();
        return projects.findById(projectId)
                .map(projectResolver::masterOf)
                .flatMap(master -> connections.findFirstByProjectIdAndStatus(master.getId(), GitRepositoryStatus.ACTIVE)
                        .or(() -> connections.findFirstByProjectIdOrderByIdDesc(master.getId())));
    }

    private BacklogGitLinksView.RepositoryRef repositoryOf(Long projectId) {
        return repositoryOfTask(projectId).map(row -> new BacklogGitLinksView.RepositoryRef(row.getId(), row.getFullName(),
                row.getHtmlUrl(), row.getStatus())).orElse(null);
    }
}
