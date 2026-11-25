package com.example.starter_project_2025.system.git_integration.domain;

/**
 * Lifecycle of a synchronization job: PENDING → RUNNING → SUCCEEDED | PARTIAL | FAILED (or back to
 * PENDING to retry, to yield the worker, or to wait for the GitHub rate limit).
 */
public enum GitSyncJobStatus {
    /** Waiting for a worker; picked up once {@code next_run_at} has passed. */
    PENDING,
    /** Claimed by a worker. */
    RUNNING,
    SUCCEEDED,
    /** SY-01: gave up after some commit pages were stored; the cursor is kept so it can resume. */
    PARTIAL,
    /** Gave up: a permanent error, or every attempt failed before anything was stored. */
    FAILED;

    public boolean inProgress() {
        return this == PENDING || this == RUNNING;
    }
}
