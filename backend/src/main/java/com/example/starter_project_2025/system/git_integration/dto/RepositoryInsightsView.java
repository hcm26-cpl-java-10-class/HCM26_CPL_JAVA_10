package com.example.starter_project_2025.system.git_integration.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * WS-GH-02: activity of a project's repository over a period ({@code from}..{@code to}, both
 * included, in the server time zone) plus the current state of its open pull requests.
 * {@code repositoryId} is null when no repository is linked: then every count is 0, {@code daily}
 * still lists each day of the period and the other lists are empty.
 */
public record RepositoryInsightsView(
        Long repositoryId,
        String range,
        LocalDate from,
        LocalDate to,
        LocalDateTime generatedAt,
        Summary summary,
        List<DailyActivity> daily,
        List<ContributorStat> contributors,
        long otherContributors,
        List<BranchStat> branches,
        PullRequestHealth pullRequests,
        boolean truncated) {

    /** Totals of the period. {@code medianHoursToMerge} is null when no pull request was merged in it. */
    public record Summary(long commits, long activeDays, long contributors, long pullRequestsOpened,
                          long pullRequestsMerged, Double medianHoursToMerge) {
        public static final Summary NONE = new Summary(0, 0, 0, 0, 0, null);
    }

    public record DailyActivity(LocalDate date, long commits, long pullRequestsOpened, long pullRequestsMerged) {
    }

    /**
     * A person who committed, opened a pull request or reviewed in the period. {@code matched} is
     * false when the commits carry no GitHub login (they are grouped by author name).
     * GI-06: {@code mapped} (with {@code userId}, {@code memberName}) when the person is a project
     * member through a mapped GitHub account or assigned e-mail; {@code contributorId} of an
     * unmapped person lets the PM open them in the Members view.
     */
    public record ContributorStat(String login, String name, boolean matched, long commits, long pullRequestsOpened,
                                  long reviews, LocalDateTime lastActiveAt, Long userId, String memberName,
                                  boolean mapped, Long contributorId) {
    }

    /** A branch (without refs/heads/) commits of the period were first pushed to. */
    public record BranchStat(String name, long commits, LocalDateTime lastCommitAt) {
    }

    /** Current state of the open pull requests (does not depend on the period). */
    public record PullRequestHealth(long open, long awaitingReview, long changesRequested, long stale, int staleDays,
                                    List<AttentionItem> attention) {
    }

    public record AttentionItem(Attention reason, GitPullRequestItem pullRequest) {
    }

    /** Why an open pull request needs attention, most urgent first. */
    public enum Attention { CHANGES_REQUESTED, AWAITING_REVIEW, STALE }
}
