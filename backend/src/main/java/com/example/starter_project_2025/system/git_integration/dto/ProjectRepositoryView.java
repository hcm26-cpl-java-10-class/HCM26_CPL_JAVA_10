package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;

import java.time.LocalDateTime;

/**
 * GI-04: the repository of a project. For a module it is the master project's
 * repository ({@code inherited = true}); {@code repository} is null while none is linked.
 */
public record ProjectRepositoryView(
        ProjectRef project,
        MasterRef masterProject,
        boolean inherited,
        RepositoryView repository,
        GitSyncJobView latestSync,
        boolean canLink,
        boolean canSync) {

    public record ProjectRef(Long id, String code, String name, boolean master) {
    }

    public record MasterRef(Long id, String code, String name, String status, long moduleCount) {
    }

    public record RepositoryView(
            Long id,
            Long externalId,
            String owner,
            String name,
            String fullName,
            String htmlUrl,
            String visibility,
            String defaultBranch,
            GitRepositoryStatus status,
            InstallationRef installation,
            UserRef linkedBy,
            LocalDateTime linkedAt,
            LocalDateTime lastSyncedAt,
            /* SY-01: commits stored for the connection, and when its whole history was last imported (NULL = never). */
            long commitCount,
            LocalDateTime historySyncedAt) {
    }

    public record InstallationRef(Long id, String accountLogin, String accountType, GitInstallationStatus status) {
    }

    public record UserRef(Long id, String name) {
    }
}
