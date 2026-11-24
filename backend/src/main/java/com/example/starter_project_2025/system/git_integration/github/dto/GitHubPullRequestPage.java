package com.example.starter_project_2025.system.git_integration.github.dto;

import java.util.List;

/**
 * SY-02: one page of a repository's pull requests, most recently updated first.
 *
 * @param repositoryFound false when the installation cannot see the repository
 * @param cursorRejected  GitHub refused the {@code after} cursor: read again from the first page
 */
public record GitHubPullRequestPage(
        boolean repositoryFound,
        boolean cursorRejected,
        List<GitHubPullRequestNode> pullRequests,
        boolean hasNextPage,
        String endCursor,
        Integer totalCount,
        GitHubCommitHistoryPage.RateLimit rateLimit) {

    public static GitHubPullRequestPage notFound(GitHubCommitHistoryPage.RateLimit rateLimit) {
        return new GitHubPullRequestPage(false, false, List.of(), false, null, null, rateLimit);
    }

    public static GitHubPullRequestPage invalidCursor(GitHubCommitHistoryPage.RateLimit rateLimit) {
        return new GitHubPullRequestPage(true, true, List.of(), false, null, null, rateLimit);
    }
}
