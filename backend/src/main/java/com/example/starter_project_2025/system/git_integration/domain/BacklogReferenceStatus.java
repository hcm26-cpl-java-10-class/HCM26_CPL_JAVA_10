package com.example.starter_project_2025.system.git_integration.domain;

/**
 * SY-05: verdict on one Task ID written in a commit message or a pull request.
 * Only {@link #LINKED} creates a link; the others keep the reason for display.
 */
public enum BacklogReferenceStatus {
    /** The task exists in the master project or one of its modules: linked. */
    LINKED,
    /** No such task in the tenant, or it was deleted (AC03). */
    INVALID,
    /** The task belongs to another project of the tenant (AC04). */
    OUTSIDE_PROJECT,
    /** The commit or pull request does not mention any Task ID. */
    MISSING,
    /** TM-03: a valid Task ID, but a user unlinked the pull request from that task; not linked again automatically. */
    EXCLUDED
}
