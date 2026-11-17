package com.example.starter_project_2025.system.git_integration.ingestion.event;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;

/**
 * SY-04 contract for Analytics: a pull request was created or updated with newer
 * data. Not published for stale (out-of-order) events. Listen AFTER_COMMIT.
 */
public record PullRequestIngestedEvent(
        Long tenantId,
        Long projectId,
        Long repositoryId,
        Long pullRequestId,
        int number,
        String action,
        GitPullRequestState state,
        boolean created) {
}
