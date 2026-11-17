package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.dto.GitCommitItem;
import com.example.starter_project_2025.system.git_integration.dto.GitPage;
import com.example.starter_project_2025.system.git_integration.dto.GitPullRequestDetail;
import com.example.starter_project_2025.system.git_integration.dto.GitPullRequestItem;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryActivityView;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventStore;
import com.example.starter_project_2025.system.project.domain.Project;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * SY-04: read side of the data synchronized from webhooks, per project. A module
 * reads its master project's repository. The ACTIVE connection is used, or the
 * latest UNAVAILABLE one so its history stays visible.
 */
@Service
@RequiredArgsConstructor
public class RepositoryActivityQueryService {

    static final int MAX_PAGE_SIZE = 100;

    private final GitIntegrationAccessService access;
    private final GitProjectResolver projectResolver;
    private final GitRepositoryLinkPolicy policy;
    private final GitRepositoryRepository connections;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final GitWebhookEventRepository events;

    public record CommitQuery(String q, String author, String branch, LocalDateTime from, LocalDateTime to, int page, int size) {
    }

    public record PullRequestQuery(GitPullRequestState state, String q, int page, int size) {
    }

    @Transactional(readOnly = true)
    public RepositoryActivityView activity(Long projectId) {
        Optional<GitRepository> found = repositoryOf(projectId);
        if (found.isEmpty()) return RepositoryActivityView.none();
        GitRepository repository = found.get();

        Map<GitPullRequestState, Long> byState = new EnumMap<>(GitPullRequestState.class);
        for (Object[] row : pullRequests.countByState(repository.getId())) {
            byState.put((GitPullRequestState) row[0], (Long) row[1]);
        }
        return new RepositoryActivityView(
                repository.getId(),
                repository.getStatus(),
                commits.countByRepositoryId(repository.getId()),
                commits.findFirstByRepositoryIdOrderByCommittedAtDescIdDesc(repository.getId()).map(this::commitItem).orElse(null),
                new RepositoryActivityView.PullRequestCounts(
                        byState.getOrDefault(GitPullRequestState.OPEN, 0L),
                        byState.getOrDefault(GitPullRequestState.MERGED, 0L),
                        byState.getOrDefault(GitPullRequestState.CLOSED, 0L)),
                events.lastReceivedAt(repository.getId(), GitWebhookEventStatus.PROCESSED),
                events.countByRepoExternalIdAndStatusIn(repository.getExternalId(), GitWebhookEventStore.PENDING),
                events.countByRepositoryRefAndStatus(repository.getId(), GitWebhookEventStatus.FAILED));
    }

    @Transactional(readOnly = true)
    public GitPage<GitCommitItem> commits(Long projectId, CommitQuery query) {
        int page = Math.max(query.page(), 0);
        int size = clampSize(query.size());
        Optional<GitRepository> found = repositoryOf(projectId);
        if (found.isEmpty()) return GitPage.empty(page, size);
        Long repositoryId = found.get().getId();

        Specification<GitCommit> spec = (root, cq, cb) -> {
            List<Predicate> where = new ArrayList<>();
            where.add(cb.equal(root.get("repositoryId"), repositoryId));
            if (hasText(query.q())) {
                String like = "%" + query.q().trim().toLowerCase(Locale.ROOT) + "%";
                where.add(cb.or(cb.like(cb.lower(root.get("message")), like), cb.like(cb.lower(root.get("sha")), like)));
            }
            if (hasText(query.author())) {
                String author = query.author().trim().toLowerCase(Locale.ROOT);
                where.add(cb.or(cb.equal(cb.lower(root.get("authorLogin")), author),
                        cb.equal(cb.lower(root.get("authorName")), author)));
            }
            if (hasText(query.branch())) {
                String branch = query.branch().trim();
                where.add(cb.equal(root.get("firstSeenRef"), branch.startsWith("refs/") ? branch : "refs/heads/" + branch));
            }
            if (query.from() != null) where.add(cb.greaterThanOrEqualTo(root.get("committedAt"), query.from()));
            if (query.to() != null) where.add(cb.lessThanOrEqualTo(root.get("committedAt"), query.to()));
            return cb.and(where.toArray(Predicate[]::new));
        };
        return GitPage.of(commits.findAll(spec, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("committedAt"), Sort.Order.desc("id")))), this::commitItem);
    }

    @Transactional(readOnly = true)
    public GitPage<GitPullRequestItem> pullRequests(Long projectId, PullRequestQuery query) {
        int page = Math.max(query.page(), 0);
        int size = clampSize(query.size());
        Optional<GitRepository> found = repositoryOf(projectId);
        if (found.isEmpty()) return GitPage.empty(page, size);
        Long repositoryId = found.get().getId();

        Specification<GitPullRequest> spec = (root, cq, cb) -> {
            List<Predicate> where = new ArrayList<>();
            where.add(cb.equal(root.get("repositoryId"), repositoryId));
            if (query.state() != null) where.add(cb.equal(root.get("state"), query.state()));
            if (hasText(query.q())) {
                String q = query.q().trim();
                String like = "%" + q.toLowerCase(Locale.ROOT).replaceFirst("^#", "") + "%";
                Predicate text = cb.like(cb.lower(root.get("title")), like);
                if (q.replaceFirst("^#", "").matches("\\d{1,9}")) {
                    text = cb.or(text, cb.equal(root.get("number"), Integer.parseInt(q.replaceFirst("^#", ""))));
                }
                where.add(text);
            }
            return cb.and(where.toArray(Predicate[]::new));
        };
        var result = pullRequests.findAll(spec, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("githubUpdatedAt"), Sort.Order.desc("id"))));
        Map<Long, List<GitPullRequestReview>> reviewsByPr = result.isEmpty() ? Map.of()
                : reviews.findByPullRequestIdIn(result.getContent().stream().map(GitPullRequest::getId).toList())
                .stream().collect(Collectors.groupingBy(GitPullRequestReview::getPullRequestId));
        return GitPage.of(result, pr -> pullRequestItem(pr, reviewsByPr.getOrDefault(pr.getId(), List.of())));
    }

    @Transactional(readOnly = true)
    public GitPullRequestDetail pullRequest(Long projectId, int number) {
        GitRepository repository = repositoryOf(projectId).orElseThrow(GitIntegrationException::pullRequestNotFound);
        GitPullRequest pr = pullRequests.findByRepositoryIdAndNumber(repository.getId(), number)
                .orElseThrow(GitIntegrationException::pullRequestNotFound);
        List<GitPullRequestReview> list = reviews.findByPullRequestIdOrderBySubmittedAtAscIdAsc(pr.getId());
        return new GitPullRequestDetail(pullRequestItem(pr, list), pr.getBody(), pr.getMergedByLogin(), pr.getCommitsCount(),
                list.stream().map(r -> new GitPullRequestDetail.Review(r.getId(), r.getReviewerLogin(), r.getState(),
                        r.getBody(), r.getCommitSha(), r.getSubmittedAt(), r.getDismissedAt(), r.getHtmlUrl())).toList());
    }

    /** The project's (or its master's) repository connection: ACTIVE, else the latest UNAVAILABLE one. */
    private Optional<GitRepository> repositoryOf(Long projectId) {
        User user = access.requireUser();
        Project project = projectResolver.require(user, projectId);
        policy.requireCanView(user, project);
        Project master = projectResolver.masterOf(project);
        return connections.findFirstByProjectIdAndStatus(master.getId(), GitRepositoryStatus.ACTIVE)
                .or(() -> connections.findFirstByProjectIdOrderByIdDesc(master.getId())
                        .filter(row -> row.getStatus() == GitRepositoryStatus.UNAVAILABLE));
    }

    private GitCommitItem commitItem(GitCommit c) {
        String message = c.getMessage() == null ? "" : c.getMessage();
        int newline = message.indexOf('\n');
        String headline = (newline < 0 ? message : message.substring(0, newline)).trim();
        String ref = c.getFirstSeenRef();
        String branch = ref != null && ref.startsWith("refs/heads/") ? ref.substring("refs/heads/".length()) : ref;
        return new GitCommitItem(c.getId(), c.getSha(), c.getSha().length() > 7 ? c.getSha().substring(0, 7) : c.getSha(),
                headline, message, c.getAuthorName(), c.getAuthorLogin(), c.getCommittedAt(), c.getHtmlUrl(), branch,
                c.getFilesChanged());
    }

    private static GitPullRequestItem pullRequestItem(GitPullRequest pr, List<GitPullRequestReview> reviewList) {
        return new GitPullRequestItem(pr.getId(), pr.getNumber(), pr.getTitle(), pr.getState(), Boolean.TRUE.equals(pr.getDraft()),
                pr.getAuthorLogin(), pr.getHeadRef(), pr.getBaseRef(), pr.getHtmlUrl(), pr.getAdditions(), pr.getDeletions(),
                pr.getChangedFiles(), pr.getGithubCreatedAt(), pr.getGithubUpdatedAt(), pr.getMergedAt(), pr.getClosedAt(),
                summary(reviewList));
    }

    /**
     * Each reviewer counts once, like GitHub's review decision: their last APPROVED /
     * CHANGES_REQUESTED review decides, a later dismissal cancels it, and a reviewer
     * who only commented counts as "commented".
     */
    static GitPullRequestItem.ReviewSummary summary(List<GitPullRequestReview> reviewList) {
        if (reviewList.isEmpty()) return GitPullRequestItem.ReviewSummary.NONE;
        int approved = 0;
        int changes = 0;
        int commented = 0;
        Map<String, List<GitPullRequestReview>> byReviewer = reviewList.stream()
                .collect(Collectors.groupingBy(r -> r.getReviewerLogin() == null ? "#" + r.getId() : r.getReviewerLogin()));
        for (List<GitPullRequestReview> own : byReviewer.values()) {
            GitReviewState decision = own.stream()
                    .filter(r -> r.getState() != GitReviewState.COMMENTED && r.getState() != GitReviewState.PENDING)
                    .max(Comparator.comparing(GitPullRequestReview::getSourceUpdatedAt)
                            .thenComparing(GitPullRequestReview::getSourceActionRank)
                            .thenComparing(GitPullRequestReview::getId))
                    .map(GitPullRequestReview::getState).orElse(null);
            if (decision == GitReviewState.APPROVED) approved++;
            else if (decision == GitReviewState.CHANGES_REQUESTED) changes++;
            else if (decision == null && own.stream().anyMatch(r -> r.getState() == GitReviewState.COMMENTED)) commented++;
        }
        return new GitPullRequestItem.ReviewSummary(approved, changes, commented);
    }

    private static int clampSize(int size) {
        return size < 1 ? 20 : Math.min(size, MAX_PAGE_SIZE);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
