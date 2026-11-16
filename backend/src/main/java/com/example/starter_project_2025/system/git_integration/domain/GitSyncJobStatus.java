package com.example.starter_project_2025.system.git_integration.domain;

/** Lifecycle of a synchronization job: PENDING → RUNNING → SUCCEEDED | FAILED (or back to PENDING to retry). */
public enum GitSyncJobStatus {
    /** Waiting for a worker; picked up once {@code next_run_at} has passed. */
    PENDING,
    /** Claimed by a worker. */
    RUNNING,
    SUCCEEDED,
    /** Gave up: a permanent error, or every attempt failed. */
    FAILED;

    public boolean inProgress() {
        return this == PENDING || this == RUNNING;
    }
}
