package com.example.starter_project_2025.system.git_integration.github.dto;

import java.util.List;

/**
 * SY-07: one page of the branches ({@code refs/heads/*}) of a repository, in name order.
 *
 * @param repositoryFound false when the installation cannot see the repository
 * @param cursorRejected  GitHub refused the {@code after} cursor: list again from the start
 * @param defaultBranch   NULL for an empty repository
 */
public record GitHubBranchPage(
        boolean repositoryFound,
        boolean cursorRejected,
        String defaultBranch,
        List<Branch> branches,
        boolean hasNextPage,
        String endCursor,
        Integer totalCount,
        GitHubCommitHistoryPage.RateLimit rateLimit) {

    /** {@code committedDate}: ISO-8601 with an offset, as GitHub returns it; NULL when the head is not a commit. */
    public record Branch(String name, String headOid, String committedDate) {
    }

    public static GitHubBranchPage notFound(GitHubCommitHistoryPage.RateLimit rateLimit) {
        return new GitHubBranchPage(false, false, null, List.of(), false, null, null, rateLimit);
    }

    public static GitHubBranchPage invalidCursor(GitHubCommitHistoryPage.RateLimit rateLimit) {
        return new GitHubBranchPage(true, true, null, List.of(), false, null, null, rateLimit);
    }
}
