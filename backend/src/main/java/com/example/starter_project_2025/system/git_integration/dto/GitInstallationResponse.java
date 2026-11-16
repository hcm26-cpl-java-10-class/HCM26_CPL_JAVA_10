package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;

import java.time.LocalDateTime;

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
        LocalDateTime lastVerifiedAt) {
}
