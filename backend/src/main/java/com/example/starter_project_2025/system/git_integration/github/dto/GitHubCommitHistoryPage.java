package com.example.starter_project_2025.system.git_integration.github.dto;

import java.time.Instant;
import java.util.List;

/**
 * SY-01: one page of the history of a repository's default branch.
 *
 * @param repositoryFound false when the installation cannot see the repository (renamed away, deleted, access revoked)
 * @param cursorRejected  GitHub refused the {@code after} cursor (e.g. the branch was force-pushed); read again from the start
 * @param defaultBranch   NULL for an empty repository (no commits, so no default branch yet)
 * @param endCursor       cursor of the last commit of this page, to read the next one
 * @param rateLimit       GraphQL quota after this request; NULL when GitHub did not report it
 */
public record GitHubCommitHistoryPage(
        boolean repositoryFound,
        boolean cursorRejected,
        String defaultBranch,
        String headOid,
        List<GitHubHistoryCommit> commits,
        boolean hasNextPage,
        String endCursor,
        Integer totalCount,
        RateLimit rateLimit) {

    public record RateLimit(int remaining, Instant resetAt, int cost) {
    }

    public static GitHubCommitHistoryPage notFound(RateLimit rateLimit) {
        return new GitHubCommitHistoryPage(false, false, null, null, List.of(), false, null, null, rateLimit);
    }

    public static GitHubCommitHistoryPage invalidCursor(RateLimit rateLimit) {
        return new GitHubCommitHistoryPage(true, true, null, null, List.of(), false, null, null, rateLimit);
    }

    public boolean emptyRepository() {
        return repositoryFound && !cursorRejected && defaultBranch == null;
    }
}
