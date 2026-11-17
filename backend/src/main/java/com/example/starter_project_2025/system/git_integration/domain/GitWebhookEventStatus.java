package com.example.starter_project_2025.system.git_integration.domain;

/**
 * SY-03 / SY-04: lifecycle of a received webhook delivery.
 * <pre>
 * RECEIVED ──claim──▶ PROCESSING ──▶ PROCESSED
 *                         │      └──▶ IGNORED          (nothing to do: repository not linked, tag push, …)
 *                         ├──▶ FAILED_RETRYABLE ──next_attempt_at──▶ PROCESSING …
 *                         │          └── retries exhausted ──▶ FAILED
 *                         └──▶ FAILED                  (permanent error, never retried automatically)
 * </pre>
 * The row and its payload are never deleted by processing. FAILED and IGNORED
 * events can be replayed manually, which puts them back to RECEIVED.
 */
public enum GitWebhookEventStatus {
    /** Signature verified and stored; waiting for a worker. */
    RECEIVED,
    /** Claimed by a worker. */
    PROCESSING,
    PROCESSED,
    /** Valid, but nothing to do for the platform. */
    IGNORED,
    /** The last attempt failed with a transient error; retried at {@code next_attempt_at}. */
    FAILED_RETRYABLE,
    /** Every retry failed, or the error was permanent; kept for investigation and manual replay. */
    FAILED;

    public boolean terminal() {
        return this == PROCESSED || this == IGNORED || this == FAILED;
    }
}
