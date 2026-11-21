package com.example.starter_project_2025.system.git_integration.domain;

/** What started a synchronization of a repository connection. */
public enum GitSyncJobType {
    /** Created together with the connection when a repository is linked (GI-04). */
    INITIAL,
    /** Requested by a user, e.g. "Retry sync". */
    MANUAL,
    /** SY-01: periodic reconcile that catches commits a failed webhook missed. */
    SCHEDULED,
    /** Triggered by a GitHub webhook delivery (later US). */
    WEBHOOK
}
