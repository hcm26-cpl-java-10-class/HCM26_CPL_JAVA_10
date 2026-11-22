package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;

import java.time.LocalDateTime;
import java.util.List;

/**
 * GI-04: the repository of a project. For a module it is the master project's
 * repository ({@code inherited = true}); {@code repository} is null while none is linked.
 * <p>
 * GI-05: {@code repository} is the master's current repository (ACTIVE, ERROR or DISCONNECTED);
 * {@code previousRepositories} are the ones unlinked before, whose data stays in the analytics.
 * A module gets every action flag false (read-only).
 */
public record ProjectRepositoryView(
        ProjectRef project,
        MasterRef masterProject,
        boolean inherited,
        RepositoryView repository,
        GitSyncJobView latestSync,
        boolean canLink,
        boolean canSync,
        /* GI-05: "Sync again" of a repository in ERROR / DISCONNECTED (checks the access on GitHub first). */
        boolean canResync,
        /* GI-05: "Unlink repository". */
        boolean canUnlink,
        List<PreviousRepository> previousRepositories,
        /* SY-06: may open the synchronization history (PM of the master or Git Integration manager; a module reads its master's). */
        boolean canViewSyncHistory) {

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
            LocalDateTime historySyncedAt,
            /* SY-02: pull requests stored for the connection, and when they were last read to the end (NULL = never). */
            long pullRequestCount,
            LocalDateTime pullRequestsSyncedAt,
            /* GI-05: why it is not ACTIVE (GitRepositoryReason) and since when. */
            String statusReason,
            LocalDateTime statusChangedAt,
            /* GI-07: DISCONNECTED because its installation was disconnected: connect GitHub again, then link again. */
            boolean installationGone) {
    }

    /** GI-05: a repository unlinked from the master project; its synchronized data is kept. */
    public record PreviousRepository(
            Long id,
            String fullName,
            String htmlUrl,
            LocalDateTime linkedAt,
            LocalDateTime unlinkedAt,
            UserRef unlinkedBy,
            long commitCount,
            long pullRequestCount) {
    }

    public record InstallationRef(Long id, String accountLogin, String accountType, GitInstallationStatus status) {
    }

    public record UserRef(Long id, String name) {
    }
}
