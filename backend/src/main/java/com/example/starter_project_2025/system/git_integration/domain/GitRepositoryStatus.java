package com.example.starter_project_2025.system.git_integration.domain;

/** Lifecycle of a repository connection (a GitHub repository linked to a project). */
public enum GitRepositoryStatus {
    /** Linked to the project and accessible through its installation. */
    ACTIVE,
    /** Unlinked from the project by a user; kept for history. */
    INACTIVE,
    /** Repository deleted, access revoked, or its installation is gone. */
    UNAVAILABLE
}
