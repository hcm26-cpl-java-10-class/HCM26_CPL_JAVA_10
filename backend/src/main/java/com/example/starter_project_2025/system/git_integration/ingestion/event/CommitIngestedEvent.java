package com.example.starter_project_2025.system.git_integration.ingestion.event;

import java.util.List;

/**
 * SY-04 contract for Analytics: new commits were stored for a repository connection.
 * Published inside the ingesting transaction; listen with
 * {@code @TransactionalEventListener(phase = AFTER_COMMIT)} so the rows are visible.
 * Only commits stored for the first time are listed (a replay publishes nothing).
 */
public record CommitIngestedEvent(
        Long tenantId,
        Long projectId,
        Long repositoryId,
        Long webhookEventId,
        String ref,
        List<Long> commitIds,
        /* SY-01: the sync job that imported the commits; NULL when a webhook did. */
        Long syncJobId) {

    public CommitIngestedEvent(Long tenantId, Long projectId, Long repositoryId, Long webhookEventId, String ref,
                               List<Long> commitIds) {
        this(tenantId, projectId, repositoryId, webhookEventId, ref, commitIds, null);
    }
}
