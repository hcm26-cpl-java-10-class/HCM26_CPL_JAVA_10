package com.example.starter_project_2025.system.git_integration.domain;

/**
 * Lifecycle of a repository connection (a GitHub repository linked to a project). GI-05: rows are
 * never deleted; the synchronized data of every connection stays in the project's analytics.
 */
public enum GitRepositoryStatus {
    /** Linked to the project and accessible through its installation. */
    ACTIVE,
    /** Unlinked from the project by a user (GI-05); kept for history, its webhooks are ignored. */
    INACTIVE,
    /**
     * GI-05: GitHub took the access away (repository removed from the installation, installation
     * deleted, repository deleted). Still the project's repository until it is unlinked, so the PM
     * sees the warning; becomes ACTIVE again when access is granted back.
     */
    DISCONNECTED,
    /** GI-05: calling GitHub for this repository failed (not confirmed as revoked); a later success clears it. */
    ERROR;

    /** GI-05: the connection is the project's current repository (occupies {@code active_project_id}). */
    public boolean holdsProject() {
        return this != INACTIVE;
    }

    /** GI-05: GitHub still sends this repository's events and they are synchronized (occupies {@code active_external_id}). */
    public boolean receivesEvents() {
        return this == ACTIVE || this == ERROR;
    }
}
