package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLink;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.dto.GitCommitItem;
import com.example.starter_project_2025.system.git_integration.dto.GitPage;
import com.example.starter_project_2025.system.git_integration.dto.GitPullRequestDetail;
import com.example.starter_project_2025.system.git_integration.dto.GitPullRequestItem;
import com.example.starter_project_2025.system.git_integration.dto.GitRepositoryLabel;
import com.example.starter_project_2025.system.git_integration.dto.GitTaskRef;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryActivityView;
import com.example.starter_project_2025.system.git_integration.dto.TaskLinkFilter;
import com.example.starter_project_2025.system.git_integration.dto.TaskLinkStats;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.git_integration.tasklink.ProjectScopeResolver;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventStore;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SY-04: read side of the data synchronized from webhooks, per project. A module
 * reads its master project's repository.
 * <p>
 * GI-05: analytics are per project, not per current repository: commits, pull
 * requests and their counts cover every connection the master ever had (unlinked
 * ones included), each item labelled with its repository; {@code repositoryId}
 * narrows a list to one of them. The current repository (ACTIVE, ERROR or
 * DISCONNECTED) is what new data comes from (webhook health, branches, link picker).
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
    private final BacklogReferenceRepository references;
    private final BacklogGitLinkRepository links;
    private final GitBacklogLookupRepository backlog;
    private final ProjectScopeResolver scopes;
    private final GitTaskRefReader taskRefs;

    /** {@code link}: SY-05 filter by task link verdict (null = all). GI-05 {@code repositoryId}: one connection (null = all). */
    public record CommitQuery(String q, String author, String branch, LocalDateTime from, LocalDateTime to,
                              TaskLinkFilter link, int page, int size, Long repositoryId) {

        public CommitQuery(String q, String author, String branch, LocalDateTime from, LocalDateTime to,
                           TaskLinkFilter link, int page, int size) {
            this(q, author, branch, from, to, link, page, size, null);
        }
    }

    public record PullRequestQuery(GitPullRequestState state, String q, TaskLinkFilter link, int page, int size, Long repositoryId) {

        public PullRequestQuery(GitPullRequestState state, String q, TaskLinkFilter link, int page, int size) {
            this(state, q, link, page, size, null);
        }
    }

    /**
     * GI-05: the connections of a project's master: every one (analytics) by id, and the current one
     * (null when none is linked now). Empty when the master never linked a repository.
     */
    public record ProjectRepositories(Project master, GitRepository current, Map<Long, GitRepository> byId) {

        public boolean isEmpty() {
            return byId.isEmpty();
        }

        public List<Long> ids() {
            return List.copyOf(byId.keySet());
        }

        /** The ids a query reads: all, or the one asked for (404 when it is not one of the project's). */
        public List<Long> select(Long repositoryId) {
            if (repositoryId == null) return ids();
            if (!byId.containsKey(repositoryId)) throw GitIntegrationException.repositoryNotLinked();
            return List.of(repositoryId);
        }

        public GitRepositoryLabel label(Long repositoryId) {
            GitRepository row = byId.get(repositoryId);
            return row == null ? null : new GitRepositoryLabel(row.getId(), row.getFullName(), row.getStatus());
        }

        public List<GitRepositoryLabel> labels() {
            return byId.values().stream().map(row -> label(row.getId())).toList();
        }
    }

    @Transactional(readOnly = true)
    public RepositoryActivityView activity(Long projectId) {
        ProjectRepositories scope = repositoriesOf(projectId);
        if (scope.isEmpty()) return RepositoryActivityView.none();
        List<Long> ids = scope.ids();
        GitRepository current = scope.current();

        Map<GitPullRequestState, Long> byState = new EnumMap<>(GitPullRequestState.class);
        for (Object[] row : pullRequests.countByState(ids)) {
            byState.put((GitPullRequestState) row[0], (Long) row[1]);
        }
        return new RepositoryActivityView(
                current == null ? null : current.getId(),
                current == null ? null : current.getStatus(),
                commits.countByRepository_IdIn(ids),
                references.countSources(ids, GitArtifactType.COMMIT, BacklogReferenceStatus.LINKED),
                commits.findFirstByRepository_IdInOrderByCommittedAtDescIdDesc(ids)
                        .map(commit -> commitItem(commit, taskRefs.refsOf(GitArtifactType.COMMIT, List.of(commit.getId()))
                                .getOrDefault(commit.getId(), List.of()), scope.label(commit.getRepositoryId())))
                        .orElse(null),
                new RepositoryActivityView.PullRequestCounts(
                        byState.getOrDefault(GitPullRequestState.OPEN, 0L),
                        byState.getOrDefault(GitPullRequestState.MERGED, 0L),
                        byState.getOrDefault(GitPullRequestState.CLOSED, 0L)),
                current == null ? null : events.lastReceivedAt(current.getId(), GitWebhookEventStatus.PROCESSED),
                current == null ? 0 : events.countByRepoExternalIdAndStatusIn(current.getExternalId(), GitWebhookEventStore.PENDING),
                current == null ? 0 : events.countByRepository_IdAndStatus(current.getId(), GitWebhookEventStatus.FAILED),
                scope.labels());
    }

    @Transactional(readOnly = true)
    public GitPage<GitCommitItem> commits(Long projectId, CommitQuery query) {
        int page = Math.max(query.page(), 0);
        int size = clampSize(query.size());
        ProjectRepositories scope = repositoriesOf(projectId);
        if (scope.isEmpty()) return GitPage.empty(page, size);
        List<Long> repositoryIds = scope.select(query.repositoryId());

        Specification<GitCommit> spec = (root, cq, cb) -> {
            List<Predicate> where = new ArrayList<>();
            where.add(root.get("repository").get("id").in(repositoryIds));
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
            if (query.link() != null) where.add(hasReference(root, cq, cb, GitArtifactType.COMMIT, query.link()));
            return cb.and(where.toArray(Predicate[]::new));
        };
        var result = commits.findAll(spec, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("committedAt"), Sort.Order.desc("id"))));
        Map<Long, List<GitTaskRef>> refs = taskRefs.refsOf(GitArtifactType.COMMIT,
                result.getContent().stream().map(GitCommit::getId).toList());
        return GitPage.of(result, commit -> commitItem(commit, refs.getOrDefault(commit.getId(), List.of()),
                scope.label(commit.getRepositoryId())));
    }

    @Transactional(readOnly = true)
    public GitPage<GitPullRequestItem> pullRequests(Long projectId, PullRequestQuery query) {
        int page = Math.max(query.page(), 0);
        int size = clampSize(query.size());
        ProjectRepositories scope = repositoriesOf(projectId);
        if (scope.isEmpty()) return GitPage.empty(page, size);
        List<Long> repositoryIds = scope.select(query.repositoryId());

        Specification<GitPullRequest> spec = (root, cq, cb) -> {
            List<Predicate> where = new ArrayList<>();
            where.add(root.get("repository").get("id").in(repositoryIds));
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
            if (query.link() != null) where.add(hasReference(root, cq, cb, GitArtifactType.PULL_REQUEST, query.link()));
            return cb.and(where.toArray(Predicate[]::new));
        };
        var result = pullRequests.findAll(spec, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("githubUpdatedAt"), Sort.Order.desc("id"))));
        Map<Long, List<GitPullRequestReview>> reviewsByPr = result.isEmpty() ? Map.of()
                : reviews.findByPullRequest_IdIn(result.getContent().stream().map(GitPullRequest::getId).toList())
                .stream().collect(Collectors.groupingBy(GitPullRequestReview::getPullRequestId));
        Map<Long, List<GitTaskRef>> refs = taskRefs.refsOf(GitArtifactType.PULL_REQUEST,
                result.getContent().stream().map(GitPullRequest::getId).toList());
        return GitPage.of(result, pr -> pullRequestItem(pr, reviewsByPr.getOrDefault(pr.getId(), List.of()),
                refs.getOrDefault(pr.getId(), List.of()), scope.label(pr.getRepositoryId())));
    }

    @Transactional(readOnly = true)
    public GitPullRequestDetail pullRequest(Long projectId, int number) {
        return pullRequest(projectId, number, null);
    }

    /**
     * GI-05: a number is unique within one repository only. {@code repositoryId} picks the
     * repository; without it the current repository's pull request is preferred, then the newest.
     */
    @Transactional(readOnly = true)
    public GitPullRequestDetail pullRequest(Long projectId, int number, Long repositoryId) {
        ProjectRepositories scope = repositoriesOf(projectId);
        if (scope.isEmpty()) throw GitIntegrationException.pullRequestNotFound();
        List<Long> ids = scope.select(repositoryId);
        Optional<GitPullRequest> preferred = repositoryId == null && scope.current() != null
                ? pullRequests.findByRepository_IdAndNumber(scope.current().getId(), number) : Optional.empty();
        GitPullRequest pr = preferred.or(() -> pullRequests.findFirstByRepository_IdInAndNumberOrderByIdDesc(ids, number))
                .orElseThrow(GitIntegrationException::pullRequestNotFound);
        List<GitPullRequestReview> list = reviews.findByPullRequest_IdOrderBySubmittedAtAscIdAsc(pr.getId());
        List<GitTaskRef> refs = taskRefs.refsOf(GitArtifactType.PULL_REQUEST, List.of(pr.getId())).getOrDefault(pr.getId(), List.of());
        return new GitPullRequestDetail(pullRequestItem(pr, list, refs, scope.label(pr.getRepositoryId())), pr.getBody(), pr.getMergedByLogin(), pr.getCommitsCount(),
                list.stream().map(r -> new GitPullRequestDetail.Review(r.getId(), r.getReviewerLogin(), r.getState(),
                        r.getBody(), r.getCommitSha(), r.getSubmittedAt(), r.getDismissedAt(), r.getHtmlUrl())).toList());
    }

    /**
     * SY-05: how well the repository's commits and pull requests reference tasks, plus the
     * active tasks of the project tree that are In progress without any commit yet.
     */
    @Transactional(readOnly = true)
    public TaskLinkStats taskLinkStats(Long projectId) {
        ProjectRepositories scope = repositoriesOf(projectId);
        if (scope.isEmpty()) return TaskLinkStats.none();
        List<Long> ids = scope.ids();
        return new TaskLinkStats(
                counts(ids, GitArtifactType.COMMIT, commits.countByRepository_IdIn(ids)),
                counts(ids, GitArtifactType.PULL_REQUEST, pullRequests.countByRepository_IdIn(ids)),
                links.countLinkedItems(ids, GitArtifactType.COMMIT),
                backlog.countWithoutLinks(scopes.scope(scope.master().getId()), SprintBacklogStatus.IN_PROGRESS,
                        GitArtifactType.COMMIT));
    }

    /** SY-05: the current repository of a project (checks the caller may view the project). */
    @Transactional(readOnly = true)
    public Optional<GitRepository> repositoryFor(Long projectId) {
        return Optional.ofNullable(repositoriesOf(projectId).current());
    }

    /** GI-05: every connection of the project's master and its current one (checks the caller may view the project). */
    @Transactional(readOnly = true)
    public ProjectRepositories repositoriesFor(Long projectId) {
        return repositoriesOf(projectId);
    }

    private TaskLinkStats.Counts counts(List<Long> repositoryIds, GitArtifactType type, long total) {
        Map<BacklogReferenceStatus, Long> byStatus = new EnumMap<>(BacklogReferenceStatus.class);
        for (Object[] row : references.countSourcesByStatus(repositoryIds, type)) {
            byStatus.put((BacklogReferenceStatus) row[0], (Long) row[1]);
        }
        return new TaskLinkStats.Counts(total, references.countProcessedSources(repositoryIds, type),
                links.countLinkedArtifacts(repositoryIds, type),
                references.countUnlinkedMissingSources(repositoryIds, type),
                byStatus.getOrDefault(BacklogReferenceStatus.INVALID, 0L),
                byStatus.getOrDefault(BacklogReferenceStatus.OUTSIDE_PROJECT, 0L));
    }

    /**
     * The commit / pull request has a reference whose verdict is one of the filter's.
     * LINKED reads the link table instead, so manual links (TM-03) count as linked too,
     * and a linked source is never "No task ID".
     */
    private static Predicate hasReference(Root<?> root, CriteriaQuery<?> query, CriteriaBuilder cb,
                                          GitArtifactType type, TaskLinkFilter filter) {
        if (filter == TaskLinkFilter.LINKED) return isLinked(root, query, cb, type);
        Set<BacklogReferenceStatus> others = EnumSet.copyOf(filter.statuses());
        boolean missing = others.remove(BacklogReferenceStatus.MISSING);
        List<Predicate> any = new ArrayList<>();
        if (!others.isEmpty()) any.add(hasStatus(root, query, cb, type, others));
        if (missing) {
            any.add(cb.and(hasStatus(root, query, cb, type, Set.of(BacklogReferenceStatus.MISSING)),
                    cb.not(isLinked(root, query, cb, type))));
        }
        return cb.or(any.toArray(Predicate[]::new));
    }

    private static Predicate isLinked(Root<?> root, CriteriaQuery<?> query, CriteriaBuilder cb, GitArtifactType type) {
        Subquery<Long> linked = query.subquery(Long.class);
        Root<BacklogGitLink> link = linked.from(BacklogGitLink.class);
        linked.select(link.get("id")).where(
                cb.equal(link.get("artifactType"), type),
                cb.equal(link.get("artifactKey"), root.get("id")));
        return cb.exists(linked);
    }

    private static Predicate hasStatus(Root<?> root, CriteriaQuery<?> query, CriteriaBuilder cb,
                                       GitArtifactType type, Set<BacklogReferenceStatus> statuses) {
        Subquery<Long> sub = query.subquery(Long.class);
        Root<BacklogReference> ref = sub.from(BacklogReference.class);
        sub.select(ref.get("id")).where(
                cb.equal(ref.get("sourceType"), type),
                cb.equal(ref.get("sourceKey"), root.get("id")),
                ref.get("status").in(statuses));
        return cb.exists(sub);
    }

    /** GI-05: the connections of the project's (or its master's) repository, newest link first. */
    private ProjectRepositories repositoriesOf(Long projectId) {
        User user = access.requireUser();
        Project project = projectResolver.require(user, projectId);
        policy.requireCanView(user, project);
        Project master = projectResolver.masterOf(project);
        Map<Long, GitRepository> byId = new LinkedHashMap<>();
        connections.findByProject_IdOrderByLinkedAtDescIdDesc(master.getId()).forEach(row -> byId.put(row.getId(), row));
        GitRepository current = byId.values().stream().filter(row -> row.getStatus().holdsProject()).findFirst().orElse(null);
        return new ProjectRepositories(master, current, byId);
    }

    static GitCommitItem commitItem(GitCommit c, List<GitTaskRef> refs) {
        return commitItem(c, refs, null);
    }

    static GitCommitItem commitItem(GitCommit c, List<GitTaskRef> refs, GitRepositoryLabel repository) {
        String message = c.getMessage() == null ? "" : c.getMessage();
        int newline = message.indexOf('\n');
        String headline = (newline < 0 ? message : message.substring(0, newline)).trim();
        String ref = c.getFirstSeenRef();
        String branch = ref != null && ref.startsWith("refs/heads/") ? ref.substring("refs/heads/".length()) : ref;
        return new GitCommitItem(c.getId(), c.getSha(), c.getSha().length() > 7 ? c.getSha().substring(0, 7) : c.getSha(),
                headline, message, c.getAuthorName(), c.getAuthorLogin(), c.getCommittedAt(), c.getHtmlUrl(), branch,
                c.getFilesChanged(), c.getParentCount() != null && c.getParentCount() > 1, refs, repository);
    }

    static GitPullRequestItem pullRequestItem(GitPullRequest pr, List<GitPullRequestReview> reviewList, List<GitTaskRef> refs) {
        return pullRequestItem(pr, reviewList, refs, null);
    }

    static GitPullRequestItem pullRequestItem(GitPullRequest pr, List<GitPullRequestReview> reviewList, List<GitTaskRef> refs,
                                              GitRepositoryLabel repository) {
        return new GitPullRequestItem(pr.getId(), pr.getNumber(), pr.getTitle(), pr.getState(), Boolean.TRUE.equals(pr.getDraft()),
                pr.getAuthorLogin(), pr.getHeadRef(), pr.getBaseRef(), pr.getHtmlUrl(), pr.getAdditions(), pr.getDeletions(),
                pr.getChangedFiles(), pr.getGithubCreatedAt(), pr.getGithubUpdatedAt(), pr.getMergedAt(), pr.getClosedAt(),
                summary(reviewList), refs, repository);
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
