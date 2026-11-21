package com.example.starter_project_2025.system.git_integration.domain;

/** SY-01: the step a synchronization job is at, so a resumed job skips the steps already done. */
public enum GitSyncPhase {
    /** Check access, refresh the repository snapshot, count branches (GI-04). */
    METADATA,
    /** Import the commit history of the default branch, page by page (SY-01). */
    COMMITS,
    DONE
}
