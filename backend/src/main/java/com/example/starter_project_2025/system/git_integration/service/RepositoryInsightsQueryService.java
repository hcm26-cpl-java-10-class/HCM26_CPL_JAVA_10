package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.contributor.ContributorDirectory;
import com.example.starter_project_2025.system.git_integration.contributor.ContributorIdentity;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitContributor;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.dto.GitBranchItem;
import com.example.starter_project_2025.system.git_integration.dto.GitPullRequestItem;
import com.example.starter_project_2025.system.git_integration.dto.GitTaskRef;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView.Attention;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView.ActivityBucket;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView.AttentionItem;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView.BranchStat;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView.ContributorStat;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView.DailyActivity;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView.PullRequestHealth;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView.Summary;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitContributorRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository.PullRequestStatRow;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository.ReviewStatRow;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WS-GH-02: activity insights of a project's repository (a module reads its master's), computed
 * when read from the synchronized commits, pull requests and reviews: no aggregate table.
 * Days are calendar days of {@code gitIntegrationClock}, the zone the timestamps are stored in.
 */
@Service
public class RepositoryInsightsQueryService {

    static final int MAX_OPEN_PULL_REQUESTS = 500;
    static final int TOP_CONTRIBUTORS = 10;
    static final int TOP_BRANCHES = 8;
    static final int ATTENTION_ROWS = 5;
    static final int STALE_DAYS = 3;
    static final int DEFAULT_BRANCH_LIMIT = 50;
    static final int MAX_BRANCH_LIMIT = 100;
    private static final String HEADS = "refs/heads/";

    private final RepositoryActivityQueryService activity;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final GitTaskRefReader taskRefs;
    private final GitContributorRepository contributorRows;
    private final UserRepository users;
    private final Clock clock;

    public RepositoryInsightsQueryService(RepositoryActivityQueryService activity, GitCommitRepository commits,
                                          GitPullRequestRepository pullRequests, GitPullRequestReviewRepository reviews,
                                          GitTaskRefReader taskRefs, GitContributorRepository contributorRows,
                                          UserRepository users, @Qualifier("gitIntegrationClock") Clock clock) {
        this.activity = activity;
        this.commits = commits;
        this.pullRequests = pullRequests;
        this.reviews = reviews;
        this.taskRefs = taskRefs;
        this.contributorRows = contributorRows;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public RepositoryInsightsView insights(Long projectId, String rawRange) {
        return insights(projectId, rawRange, null, null, null);
    }

    @Transactional(readOnly = true)
    public RepositoryInsightsView insights(Long projectId, String rawRange, Long repositoryId) {
        return insights(projectId, rawRange, null, null, repositoryId);
    }

    /**
     * GI-05: insights of the project, over every repository it ever linked (unlinked ones included),
     * or of the one {@code repositoryId} names. {@code repositoryId} of the view is the current
     * repository (or the one asked for). {@code since}/{@code until} only go with {@code range=custom}.
     * Counts are aggregated in the database, so long periods are not capped.
     */
    @Transactional(readOnly = true)
    public RepositoryInsightsView insights(Long projectId, String rawRange, LocalDate since, LocalDate until, Long repositoryId) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        InsightsRange range = InsightsPeriod.requireValid(rawRange, since, until, today);

        RepositoryActivityQueryService.ProjectRepositories scope = activity.repositoriesFor(projectId);
        if (scope.isEmpty()) {
            InsightsPeriod period = InsightsPeriod.resolve(range, since, until, today, () -> null);
            Map<LocalDate, long[]> days = emptyDays(period.from(), period.to());
            return new RepositoryInsightsView(null, range.key(), period.from(), period.to(), now, Summary.NONE,
                    daily(period, days), period.granularity().name(), buckets(period, days), List.of(), 0,
                    List.of(), new PullRequestHealth(0, 0, 0, 0, STALE_DAYS, List.of()), false);
        }
        List<Long> repositoryIds = scope.select(repositoryId);
        Long viewRepositoryId = repositoryId != null ? repositoryId : scope.current() != null ? scope.current().getId() : null;
        InsightsPeriod period = InsightsPeriod.resolve(range, since, until, today, () -> earliestActivity(repositoryIds));
        Map<LocalDate, long[]> days = emptyDays(period.from(), period.to());
        LocalDateTime start = period.from().atStartOfDay();
        LocalDateTime end = period.to().plusDays(1).atStartOfDay();

        long commitCount = 0;
        for (GitCommitRepository.DayCountRow row : commits.commitsPerDay(repositoryIds, start, end)) {
            long[] counts = days.get(row.getDay());
            long count = row.getCount() == null ? 0 : row.getCount();
            if (counts != null) counts[0] += count;
            commitCount += count;
        }
        List<PullRequestStatRow> opened = pullRequests.openedBetween(repositoryIds, start, end);
        List<PullRequestStatRow> merged = pullRequests.mergedBetween(repositoryIds, start, end);
        List<ReviewStatRow> reviewRows = reviews.submittedBetween(repositoryIds, start, end);
        opened.forEach(row -> count(days, row.getGithubCreatedAt(), 1));
        merged.forEach(row -> count(days, row.getMergedAt(), 2));

        ContributorDirectory directory = new ContributorDirectory(contributorRows.findByMasterProject_IdOrderByIdAsc(scope.master().getId()));
        Map<String, Tally> people = contributors(commits.authorsBetween(repositoryIds, start, end), opened, reviewRows, directory);
        nameMembers(people.values());
        List<ContributorStat> top = people.values().stream()
                .sorted(Comparator.comparingLong((Tally t) -> t.commits).reversed()
                        .thenComparing(Comparator.comparingLong((Tally t) -> t.pullRequests).reversed())
                        .thenComparing(Comparator.comparingLong((Tally t) -> t.reviews).reversed())
                        .thenComparing(t -> t.display().toLowerCase(Locale.ROOT)))
                .limit(TOP_CONTRIBUTORS)
                .map(Tally::toStat)
                .toList();

        long activeDays = days.values().stream().filter(counts -> counts[0] > 0).count();
        Summary summary = new Summary(commitCount, activeDays, people.size(), opened.size(), merged.size(),
                medianHoursToMerge(merged));
        List<BranchStat> branches = commits.branchesBetween(repositoryIds, start, end, PageRequest.of(0, TOP_BRANCHES)).stream()
                .map(row -> new BranchStat(row.getRef().substring(HEADS.length()), row.getCommits() == null ? 0 : row.getCommits(),
                        row.getLastCommitAt()))
                .filter(branch -> !branch.name().isEmpty())
                .toList();
        return new RepositoryInsightsView(viewRepositoryId, range.key(), period.from(), period.to(), now, summary,
                daily(period, days), period.granularity().name(), buckets(period, days), top,
                Math.max(0, people.size() - TOP_CONTRIBUTORS), branches, pullRequestHealth(scope, repositoryIds, now), false);
    }

    /** First day with a synchronized commit or pull request of the repositories; null when there is none. */
    private LocalDate earliestActivity(List<Long> repositoryIds) {
        LocalDateTime commit = commits.earliestCommittedAt(repositoryIds);
        LocalDateTime pullRequest = pullRequests.earliestOpenedAt(repositoryIds);
        LocalDateTime first = commit == null ? pullRequest : pullRequest == null || commit.isBefore(pullRequest) ? commit : pullRequest;
        return first == null ? null : first.toLocalDate();
    }

    /** All-time branches of the project's repository, latest activity first ({@code q} matches the name). */
    @Transactional(readOnly = true)
    public List<GitBranchItem> branches(Long projectId, String q, Integer limit) {
        Optional<GitRepository> found = activity.repositoryFor(projectId);
        if (found.isEmpty()) return List.of();
        int size = limit == null ? DEFAULT_BRANCH_LIMIT : Math.max(1, Math.min(limit, MAX_BRANCH_LIMIT));
        String text = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (text.length() > 100) text = text.substring(0, 100);
        String pattern = HEADS + (text.isEmpty() ? "%" : "%" + text + "%");
        return commits.branches(found.get().getId(), pattern, PageRequest.of(0, size)).stream()
                .map(row -> new GitBranchItem(row.getRef().substring(HEADS.length()),
                        row.getCommits() == null ? 0 : row.getCommits(), row.getLastCommitAt()))
                .toList();
    }

    // ---- period counts --------------------------------------------------------------------------

    private static Map<LocalDate, long[]> emptyDays(LocalDate from, LocalDate to) {
        Map<LocalDate, long[]> days = new LinkedHashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) days.put(day, new long[3]);
        return days;
    }

    private static void count(Map<LocalDate, long[]> days, LocalDateTime at, int index) {
        if (at == null) return;
        long[] counts = days.get(at.toLocalDate());
        if (counts != null) counts[index]++;
    }

    /** Every day of periods up to about 90 days; empty for longer ones (the chart reads {@code buckets}). */
    private static List<DailyActivity> daily(InsightsPeriod period, Map<LocalDate, long[]> days) {
        if (!period.listsDays()) return List.of();
        return days.entrySet().stream()
                .map(entry -> new DailyActivity(entry.getKey(), entry.getValue()[0], entry.getValue()[1], entry.getValue()[2]))
                .toList();
    }

    private static List<ActivityBucket> buckets(InsightsPeriod period, Map<LocalDate, long[]> days) {
        List<ActivityBucket> result = new ArrayList<>();
        for (LocalDate[] bucket : period.buckets()) {
            long[] sum = new long[3];
            for (LocalDate day = bucket[0]; !day.isAfter(bucket[1]); day = day.plusDays(1)) {
                long[] counts = days.get(day);
                for (int i = 0; i < 3; i++) sum[i] += counts[i];
            }
            result.add(new ActivityBucket(bucket[0], bucket[1], sum[0], sum[1], sum[2]));
        }
        return result;
    }

    /** Median of merged_at − created_at in hours (one decimal); null when nothing was merged. */
    static Double medianHoursToMerge(List<PullRequestStatRow> merged) {
        List<Double> hours = merged.stream()
                .filter(row -> row.getGithubCreatedAt() != null && row.getMergedAt() != null)
                .map(row -> Math.max(0, Duration.between(row.getGithubCreatedAt(), row.getMergedAt()).toMinutes()) / 60.0)
                .sorted()
                .toList();
        if (hours.isEmpty()) return null;
        int middle = hours.size() / 2;
        double median = hours.size() % 2 == 1 ? hours.get(middle) : (hours.get(middle - 1) + hours.get(middle)) / 2;
        return Math.round(median * 10) / 10.0;
    }

    // ---- contributors ---------------------------------------------------------------------------

    /**
     * A person of the period. GI-06: rows of a contributor mapped to a member are grouped by that
     * member (GitHub account and assigned e-mails together); other rows by GitHub login (any
     * case), else by commit author name.
     */
    private static final class Tally {
        String login;
        String name;
        Long userId;
        String memberName;
        Long contributorId;
        long commits;
        long pullRequests;
        long reviews;
        LocalDateTime lastActiveAt;

        void touch(LocalDateTime at) {
            if (at != null && (lastActiveAt == null || at.isAfter(lastActiveAt))) lastActiveAt = at;
        }

        String display() {
            if (memberName != null) return memberName;
            return login != null ? login : Objects.requireNonNullElse(name, "");
        }

        ContributorStat toStat() {
            return new ContributorStat(login, name, login != null, commits, pullRequests, reviews, lastActiveAt,
                    userId, memberName, userId != null, contributorId);
        }
    }

    static boolean isBot(String login) {
        return ContributorIdentity.isBot(login);
    }

    private static String keyOf(String login, String name) {
        if (login != null && !login.isBlank()) return "l:" + login.trim().toLowerCase(Locale.ROOT);
        if (name != null && !name.isBlank()) return "n:" + name.trim().toLowerCase(Locale.ROOT);
        return null;
    }

    private static Map<String, Tally> contributors(List<GitCommitRepository.AuthorActivityRow> authorRows,
                                                   List<PullRequestStatRow> opened, List<ReviewStatRow> reviewRows,
                                                   ContributorDirectory directory) {
        Map<String, Tally> people = new HashMap<>();
        // Author identities are most recently active first: the first one seen gives the display name and login spelling.
        for (GitCommitRepository.AuthorActivityRow row : authorRows) {
            Tally tally = tally(people, row.getLogin(), row.getName(), row.getGithubId(), row.getEmail(),
                    directory.resolve(row.getGithubId(), row.getLogin(), row.getEmail()));
            if (tally == null) continue;
            if (tally.name == null && row.getName() != null && !row.getName().isBlank()) tally.name = row.getName().trim();
            tally.commits += row.getCount() == null ? 0 : row.getCount();
            tally.touch(row.getLastAt());
        }
        for (PullRequestStatRow row : opened) {
            Tally tally = tally(people, row.getAuthorLogin(), null, row.getAuthorGithubId(), null,
                    directory.resolve(row.getAuthorGithubId(), row.getAuthorLogin(), null));
            if (tally == null) continue;
            tally.pullRequests++;
            tally.touch(row.getGithubCreatedAt());
        }
        for (ReviewStatRow row : reviewRows) {
            Tally tally = tally(people, row.getReviewerLogin(), null, row.getReviewerGithubId(), null,
                    directory.resolve(row.getReviewerGithubId(), row.getReviewerLogin(), null));
            if (tally == null) continue;
            tally.reviews++;
            tally.touch(row.getSubmittedAt());
        }
        return people;
    }

    /** The tally of a person, created on first sight; null for bots and rows without any identity. */
    private static Tally tally(Map<String, Tally> people, String login, String name, Long githubId, String email,
                                GitContributor contributor) {
        if (isBot(login)) return null;
        String cleanLogin = login == null || login.isBlank() ? null : login.trim();
        if (contributor != null && contributor.getUserId() != null) {
            Tally member = people.computeIfAbsent("u:" + contributor.getUserId(), ignored -> {
                Tally created = new Tally();
                created.userId = contributor.getUserId();
                return created;
            });
            if (member.login == null && cleanLogin != null) member.login = cleanLogin;
            if (member.login == null && contributor.isGitHub()) member.login = contributor.getLogin();
            return member;
        }
        String identity = githubId != null ? ContributorIdentity.githubKey(githubId)
                : cleanLogin != null ? "l:" + cleanLogin.toLowerCase(Locale.ROOT)
                : ContributorIdentity.key(null, email);
        String key = contributor != null ? "c:" + contributor.getId()
                : identity != null ? identity : keyOf(login, name);
        if (key == null) return null;
        Tally tally = people.computeIfAbsent(key, ignored -> {
            Tally created = new Tally();
            created.login = cleanLogin;
            created.name = cleanLogin == null ? Objects.toString(name, "").trim() : null;
            return created;
        });
        if (tally.contributorId == null && contributor != null) tally.contributorId = contributor.getId();
        return tally;
    }

    /** Member names of the mapped tallies. */
    private void nameMembers(Collection<Tally> people) {
        Set<Long> ids = people.stream().map(t -> t.userId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return;
        Map<Long, String> names = users.findAllById(ids).stream().collect(Collectors.toMap(User::getId, user -> {
            String name = ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                    + (user.getLastName() == null ? "" : user.getLastName())).trim();
            return name.isEmpty() ? user.getEmail() : name;
        }));
        people.forEach(t -> {
            if (t.userId != null) t.memberName = names.get(t.userId);
        });
    }

    // ---- open pull requests ---------------------------------------------------------------------

    /**
     * One reason per open pull request, most urgent first: CHANGES_REQUESTED (a reviewer's current
     * decision), AWAITING_REVIEW (ready, nobody approved or asked for changes), STALE (no update for
     * {@link #STALE_DAYS} days, drafts included). Same rule as the review summary of the PR list.
     */
    static Attention attentionOf(GitPullRequest pr, GitPullRequestItem.ReviewSummary summary, LocalDateTime staleBefore) {
        if (summary.changesRequested() > 0) return Attention.CHANGES_REQUESTED;
        if (!Boolean.TRUE.equals(pr.getDraft()) && summary.approved() == 0) return Attention.AWAITING_REVIEW;
        if (pr.getGithubUpdatedAt() != null && pr.getGithubUpdatedAt().isBefore(staleBefore)) return Attention.STALE;
        return null;
    }

    private PullRequestHealth pullRequestHealth(RepositoryActivityQueryService.ProjectRepositories scope, List<Long> repositoryIds,
                                                LocalDateTime now) {
        List<GitPullRequest> open = pullRequests.findByRepository_IdInAndStateOrderByGithubUpdatedAtAscIdAsc(repositoryIds,
                GitPullRequestState.OPEN, PageRequest.of(0, MAX_OPEN_PULL_REQUESTS));
        long openCount = open.size() < MAX_OPEN_PULL_REQUESTS ? open.size() : pullRequests.countByState(repositoryIds).stream()
                .filter(row -> row[0] == GitPullRequestState.OPEN).mapToLong(row -> (Long) row[1]).sum();
        if (open.isEmpty()) return new PullRequestHealth(openCount, 0, 0, 0, STALE_DAYS, List.of());

        Map<Long, List<GitPullRequestReview>> reviewsByPr = reviews.findByPullRequest_IdIn(open.stream().map(GitPullRequest::getId).toList())
                .stream().collect(Collectors.groupingBy(GitPullRequestReview::getPullRequestId));
        LocalDateTime staleBefore = now.minusDays(STALE_DAYS);
        Map<Attention, List<GitPullRequest>> byReason = new LinkedHashMap<>();
        for (Attention reason : Attention.values()) byReason.put(reason, new ArrayList<>());
        for (GitPullRequest pr : open) { // longest without update first, kept within each reason
            Attention reason = attentionOf(pr,
                    RepositoryActivityQueryService.summary(reviewsByPr.getOrDefault(pr.getId(), List.of())), staleBefore);
            if (reason != null) byReason.get(reason).add(pr);
        }

        List<Map.Entry<Attention, GitPullRequest>> first = byReason.entrySet().stream()
                .flatMap(entry -> entry.getValue().stream().map(pr -> Map.entry(entry.getKey(), pr)))
                .limit(ATTENTION_ROWS)
                .toList();
        Map<Long, List<GitTaskRef>> refs = taskRefs.refsOf(GitArtifactType.PULL_REQUEST,
                first.stream().map(entry -> entry.getValue().getId()).toList());
        List<AttentionItem> attention = first.stream()
                .map(entry -> new AttentionItem(entry.getKey(), RepositoryActivityQueryService.pullRequestItem(entry.getValue(),
                        reviewsByPr.getOrDefault(entry.getValue().getId(), List.of()),
                        refs.getOrDefault(entry.getValue().getId(), List.of()), scope.label(entry.getValue().getRepositoryId()))))
                .toList();
        return new PullRequestHealth(openCount, byReason.get(Attention.AWAITING_REVIEW).size(),
                byReason.get(Attention.CHANGES_REQUESTED).size(), byReason.get(Attention.STALE).size(), STALE_DAYS, attention);
    }
}
