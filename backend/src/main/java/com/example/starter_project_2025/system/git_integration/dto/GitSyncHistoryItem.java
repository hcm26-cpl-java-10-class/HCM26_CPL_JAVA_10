package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistorySource;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistoryType;

import java.time.LocalDateTime;

/**
 * SY-06: one synchronization of the history (AC01): a sync job or a webhook delivery that carried Git data.
 *
 * @param rawStatus        technical status of the job / delivery (for support; the UI shows {@code status})
 * @param occurredAt       when it was queued (job) or received (webhook); the list is ordered by it
 * @param startedAt        first attempt of a job; last processing start of a webhook
 * @param recordsProcessed commits, pull requests and reviews processed; null when unknown (webhook before SY-06)
 * @param errorCode        job: why it failed / stopped / waits (e.g. {@code RATE_LIMITED}); null for webhooks
 * @param error            webhook: the error of a failed delivery (one line); null otherwise
 * @param eventType        webhook: {@code push}, {@code pull_request}, {@code pull_request_review}
 * @param retryAt          when the platform tries again by itself (PROCESSING after a failed attempt)
 * @param canRetry         a failed webhook that may be processed again now (AC04)
 */
public record GitSyncHistoryItem(
        GitSyncHistorySource source,
        Long id,
        GitRepositoryLabel repository,
        GitSyncHistoryType type,
        GitSyncHistoryStatus status,
        String rawStatus,
        LocalDateTime occurredAt,
        LocalDateTime startedAt,
        LocalDateTime finishedAt,
        Long durationMs,
        Integer recordsProcessed,
        int attempts,
        String errorCode,
        String error,
        String eventType,
        String action,
        LocalDateTime retryAt,
        boolean canRetry) {
}
