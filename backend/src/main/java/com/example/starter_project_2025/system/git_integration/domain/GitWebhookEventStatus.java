package com.example.starter_project_2025.system.git_integration.domain;

/**
 * SY-03: lifecycle of a received webhook delivery.
 * <pre>
 * RECEIVED ──claim──▶ PROCESSING ──▶ PROCESSED
 *                         │      └──▶ IGNORED   (nothing to do: unsupported event, repository not linked, …)
 *                         └──▶ FAILED ──retry (next_attempt_at)──▶ PROCESSING …
 *                                  └── attempts exhausted ──▶ DEAD
 * </pre>
 * The row and its payload are never deleted by processing (AC06: the original event is not lost).
 */
public enum GitWebhookEventStatus {
    /** Signature verified and stored; waiting for a handler (SY-04). */
    RECEIVED,
    /** Claimed by a worker. */
    PROCESSING,
    PROCESSED,
    /** Valid, but nothing to do for the platform. */
    IGNORED,
    /** The last attempt failed; retried at {@code next_attempt_at}. */
    FAILED,
    /** Every attempt failed; kept for investigation and manual replay. */
    DEAD;

    public boolean terminal() {
        return this == PROCESSED || this == IGNORED || this == DEAD;
    }
}
