package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;

/** Result of a processed callback; {@code installation} is null while an org owner's approval is pending. */
public record GitHubCallbackResponse(
        GitOAuthOutcome outcome,
        String message,
        GitInstallationResponse installation) {
}
