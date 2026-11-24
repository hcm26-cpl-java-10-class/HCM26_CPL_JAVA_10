package com.example.starter_project_2025.system.git_integration.github.dto;

import java.util.List;

/**
 * SY-07: one page of the commits of a head branch that are not on a base branch ({@code base..head}).
 *
 * @param repositoryFound false when the installation cannot see the repository
 * @param refFound        false when the base or the head branch no longer exists (deleted or renamed meanwhile)
 * @param cursorRejected  GitHub refused the {@code after} cursor: read the branch again from its first page
 * @param status          {@code AHEAD}, {@code BEHIND}, {@code DIVERGED} or {@code IDENTICAL}
 */
public record GitHubComparePage(
        boolean repositoryFound,
        boolean refFound,
        boolean cursorRejected,
        String status,
        Integer aheadBy,
        Integer behindBy,
        List<GitHubHistoryCommit> commits,
        boolean hasNextPage,
        String endCursor,
        GitHubCommitHistoryPage.RateLimit rateLimit) {

    public static GitHubComparePage notFound(GitHubCommitHistoryPage.RateLimit rateLimit) {
        return new GitHubComparePage(false, false, false, null, null, null, List.of(), false, null, rateLimit);
    }

    public static GitHubComparePage refMissing(GitHubCommitHistoryPage.RateLimit rateLimit) {
        return new GitHubComparePage(true, false, false, null, null, null, List.of(), false, null, rateLimit);
    }

    public static GitHubComparePage invalidCursor(GitHubCommitHistoryPage.RateLimit rateLimit) {
        return new GitHubComparePage(true, true, true, null, null, null, List.of(), false, null, rateLimit);
    }
}
