package com.example.starter_project_2025.system.git_integration.ingestion.event;

import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;

/**
 * SY-04 contract for Analytics: a pull request review was created or updated with
 * newer data. Not published for stale (out-of-order) events. Listen AFTER_COMMIT.
 */
public record ReviewIngestedEvent(
        Long tenantId,
        Long projectId,
        Long repositoryId,
        Long pullRequestId,
        Long reviewId,
        GitReviewState state,
        String action,
        boolean created) {
}
