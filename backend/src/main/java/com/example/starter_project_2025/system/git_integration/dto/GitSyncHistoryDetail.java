package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;

import java.time.LocalDateTime;

/**
 * SY-06 AC02: one synchronization in detail: records processed and the error, if any.
 * Payloads, headers and tokens are never returned.
 *
 * @param note    what a successful webhook did, in the platform's words (e.g. "Pull request #12 updated")
 * @param job     null for a webhook
 * @param webhook null for a job
 */
public record GitSyncHistoryDetail(
        GitSyncHistoryItem item,
        Breakdown breakdown,
        ErrorInfo error,
        String note,
        JobInfo job,
        WebhookInfo webhook) {

    /**
     * Job: what each step stored. Null fields: the step did not run. SY-07: commits added from the
     * other branches, and the branches read / unchanged (skipped) / cut at the page cap / deleted.
     */
    public record Breakdown(Long commitsInserted, Long commitsExisting, Long pullRequestsInserted,
                            Long pullRequestsUpdated, Long pullRequestsUnchanged, Long reviewsInserted,
                            Long reviewsUpdated, Long branchCommitsInserted, Long branchCommitsExisting,
                            Long branchesSynced, Long branchesSkipped, Long branchesPartial, Long branchesDeleted) {
    }

    /** {@code code}: stable error code (jobs); {@code message}: technical text, already shortened. */
    public record ErrorInfo(String code, String message) {
    }

    /**
     * @param resumedFromJobId the stopped synchronization this one continues
     * @param canSyncAgain     the viewer may start a new synchronization from here ("Sync again")
     */
    public record JobInfo(GitSyncPhase phase, Long resumedFromJobId, ProjectRepositoryView.UserRef requestedBy,
                          int maxAttempts, boolean canSyncAgain) {
    }

    /**
     * @param retryBlockedReason why a failed delivery cannot be retried: {@code PAYLOAD_PURGED},
     *                           {@code REPOSITORY_NOT_RECEIVING}; null when it can, or is not failed
     */
    public record WebhookInfo(String deliveryId, String senderLogin, int maxRetries, LocalDateTime receivedAt,
                              boolean payloadAvailable, String retryBlockedReason) {
    }
}
