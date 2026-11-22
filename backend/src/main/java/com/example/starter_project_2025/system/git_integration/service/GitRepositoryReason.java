package com.example.starter_project_2025.system.git_integration.service;

/** GI-05: why a repository connection's status last changed ({@code git_repositories.status_reason}); shown in words by the UI. */
public final class GitRepositoryReason {

    /** A user unlinked the repository from the project. */
    public static final String UNLINKED_BY_USER = "UNLINKED_BY_USER";
    /** The owner removed the repository from the GitHub App installation ({@code installation_repositories.removed}). */
    public static final String REPOSITORY_ACCESS_REMOVED = "REPOSITORY_ACCESS_REMOVED";
    /** The GitHub App installation the repository is read through was deleted ({@code installation.deleted}). */
    public static final String INSTALLATION_DELETED = "INSTALLATION_DELETED";
    /** The repository was deleted on GitHub ({@code repository.deleted}). */
    public static final String REPOSITORY_DELETED = "REPOSITORY_DELETED";
    /** GitHub answered that the repository cannot be found while it was being synchronized. */
    public static final String REPOSITORY_NOT_ACCESSIBLE = "REPOSITORY_NOT_ACCESSIBLE";
    /** A synchronization gave up after its last attempt. */
    public static final String SYNC_FAILED = "SYNC_FAILED";
    /** Access came back, but the repository is already synchronized by another project meanwhile. */
    public static final String REPOSITORY_LINKED_ELSEWHERE = "REPOSITORY_LINKED_ELSEWHERE";
    /** Converted from the former UNAVAILABLE status by the GI-05 migration. */
    public static final String LEGACY_UNAVAILABLE = "LEGACY_UNAVAILABLE";

    private GitRepositoryReason() {
    }
}
