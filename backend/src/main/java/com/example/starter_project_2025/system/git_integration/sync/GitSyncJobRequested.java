package com.example.starter_project_2025.system.git_integration.sync;

/** Published inside the transaction that queued a sync job; handled after commit. */
public record GitSyncJobRequested(Long jobId) {
}
