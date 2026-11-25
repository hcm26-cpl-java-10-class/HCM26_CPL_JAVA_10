package com.example.starter_project_2025.system.git_integration.domain;

/**
 * SY-06: status of one synchronization as shown in the history (BR4). Maps the technical states of
 * sync jobs and webhook deliveries:
 * <ul>
 *   <li>PENDING: job PENDING never attempted; webhook RECEIVED.</li>
 *   <li>PROCESSING: job RUNNING, or PENDING again after an attempt (retry / rate limit); webhook
 *       PROCESSING or FAILED_RETRYABLE (the platform still retries by itself).</li>
 *   <li>SUCCESS: job SUCCEEDED; webhook PROCESSED.</li>
 *   <li>PARTIAL_SUCCESS: job PARTIAL (stopped after storing part of the data, or a step skipped for a
 *       missing permission); webhook PROCESSED but some records could not be read (push truncated).</li>
 *   <li>FAILED: job FAILED; webhook FAILED (manual retry possible).</li>
 * </ul>
 */
public enum GitSyncHistoryStatus {
    PENDING,
    PROCESSING,
    SUCCESS,
    PARTIAL_SUCCESS,
    FAILED;

    public static GitSyncHistoryStatus ofJob(GitSyncJobStatus status, int attemptCount) {
        return switch (status) {
            case PENDING -> attemptCount > 0 ? PROCESSING : PENDING;
            case RUNNING -> PROCESSING;
            case SUCCEEDED -> SUCCESS;
            case PARTIAL -> PARTIAL_SUCCESS;
            case FAILED -> FAILED;
        };
    }

    /** Null for IGNORED: not a synchronization (not listed). */
    public static GitSyncHistoryStatus ofWebhook(GitWebhookEventStatus status, boolean partial) {
        return switch (status) {
            case RECEIVED -> PENDING;
            case PROCESSING, FAILED_RETRYABLE -> PROCESSING;
            case PROCESSED -> partial ? PARTIAL_SUCCESS : SUCCESS;
            case FAILED -> FAILED;
            case IGNORED -> null;
        };
    }
}
