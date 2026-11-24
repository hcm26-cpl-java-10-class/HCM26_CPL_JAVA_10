package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewPage;

import java.time.OffsetDateTime;

/**
 * SY-01: GitHub GraphQL API, kept behind an interface so synchronization can be tested
 * without network access. Throws {@link GitHubApiException} like {@link GitHubApiClient}:
 * {@code RATE_LIMITED} (with seconds to wait), {@code REJECTED} (missing permission, revoked
 * token) or {@code UNAVAILABLE} (network, 5xx, unexpected answer).
 */
public interface GitHubGraphQlClient {

    /**
     * One page of the history of the default branch of {@code owner/name}, newest first.
     *
     * @param since  only commits after this instant; NULL = the whole history
     * @param after  {@code endCursor} of the previous page; NULL = first page
     * @param first  commits per page (1–100)
     */
    GitHubCommitHistoryPage commitHistory(String installationToken, String owner, String name,
                                          OffsetDateTime since, String after, int first);

    /**
     * SY-02: one page of the pull requests of {@code owner/name} (open, closed and merged), most
     * recently updated first, each with its first {@code reviewsFirst} submitted reviews (PENDING
     * reviews are never requested).
     */
    GitHubPullRequestPage pullRequests(String installationToken, String owner, String name,
                                       String after, int first, int reviewsFirst);

    /** SY-02: the submitted reviews of one pull request after {@code after} (GraphQL node id of the pull request). */
    GitHubReviewPage pullRequestReviews(String installationToken, String pullRequestNodeId, String after, int first);
}
