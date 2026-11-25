package com.example.starter_project_2025.system.git_integration.domain;

/** SY-01: the step a synchronization job is at, so a resumed job skips the steps already done. */
public enum GitSyncPhase {
    /** Check access, refresh the repository snapshot, count branches (GI-04). */
    METADATA,
    /** Import the commit history of the default branch, page by page (SY-01). */
    COMMITS,
    /**
     * SY-07: list the branches, then import the commits of each changed branch that are not on the
     * default branch (skipped when branch sync is turned off or the repository is empty).
     */
    BRANCHES,
    /** Import pull requests (open, closed, merged) and their submitted reviews, page by page (SY-02). */
    PULL_REQUESTS,
    DONE
}
