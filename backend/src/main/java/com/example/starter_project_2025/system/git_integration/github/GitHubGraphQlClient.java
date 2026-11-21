package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;

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
}
