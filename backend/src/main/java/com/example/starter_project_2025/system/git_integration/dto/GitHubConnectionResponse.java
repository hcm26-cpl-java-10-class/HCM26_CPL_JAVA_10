package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitConnectionStatus;

import java.time.LocalDateTime;

public record GitHubConnectionResponse(
        Long id,
        Long projectId,
        Long installationId,
        GitConnectionStatus status,
        String accountLogin,
        String accountType,
        String repositorySelection,
        String githubUserLogin,
        Long connectedByUserId,
        String connectedByName,
        LocalDateTime connectedAt,
        LocalDateTime lastVerifiedAt) {
}
