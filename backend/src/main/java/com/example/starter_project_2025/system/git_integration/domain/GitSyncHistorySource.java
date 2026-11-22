package com.example.starter_project_2025.system.git_integration.domain;

/** SY-06: where a history entry is stored: a sync job ({@code git_sync_jobs}) or a webhook delivery ({@code git_webhook_events}). */
public enum GitSyncHistorySource {
    JOB,
    WEBHOOK
}
