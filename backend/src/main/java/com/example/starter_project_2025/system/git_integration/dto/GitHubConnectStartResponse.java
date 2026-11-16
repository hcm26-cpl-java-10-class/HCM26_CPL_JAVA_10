package com.example.starter_project_2025.system.git_integration.dto;

import java.time.LocalDateTime;

/** Where the browser must go to install the GitHub App, and until when the attempt is valid. */
public record GitHubConnectStartResponse(String installUrl, LocalDateTime expiresAt) {
}
