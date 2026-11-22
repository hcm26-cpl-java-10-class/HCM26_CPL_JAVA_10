package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;

import java.time.LocalDateTime;
import java.util.List;

/** Public view of an installation; never carries tokens or secrets. */
public record GitInstallationResponse(
        Long id,
        Long installationId,
        GitInstallationStatus status,
        String accountLogin,
        String accountType,
        String repositorySelection,
        String githubUserLogin,
        Long connectedByUserId,
        String connectedByName,
        LocalDateTime connectedAt,
        LocalDateTime lastVerifiedAt,
        /* GI-02: why and since when the installation is in its status, and the last "Check again". */
        String statusReason,
        LocalDateTime statusChangedAt,
        LocalDateTime lastCheckedAt,
        /* Master projects whose repository is read through this installation: removing the App affects them all. */
        List<LinkedProject> projects) {

    public record LinkedProject(Long id, String code, String name, String repositoryFullName, GitRepositoryStatus repositoryStatus) {
    }
}
