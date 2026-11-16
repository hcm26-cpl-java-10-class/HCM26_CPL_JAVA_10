package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;

/**
 * Result of a processed callback. {@code connection} is null when the
 * installation still waits for an organization owner's approval.
 */
public record GitHubCallbackResponse(
        GitOAuthOutcome outcome,
        Long projectId,
        String message,
        GitHubConnectionResponse connection) {
}
