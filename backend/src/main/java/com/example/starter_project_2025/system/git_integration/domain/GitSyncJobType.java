package com.example.starter_project_2025.system.git_integration.domain;

/** What started a synchronization of a repository connection. */
public enum GitSyncJobType {
    /** Created together with the connection when a repository is linked (GI-04). */
    INITIAL,
    /** Requested by a user, e.g. "Retry sync". */
    MANUAL,
    /** Periodic background synchronization (later US). */
    SCHEDULED,
    /** Triggered by a GitHub webhook delivery (later US). */
    WEBHOOK
}
