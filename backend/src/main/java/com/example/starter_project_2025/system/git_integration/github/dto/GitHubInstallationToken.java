package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/** Short-lived installation access token. Kept in memory only; never logged. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubInstallationToken(
        String token,
        @JsonProperty("expires_at") Instant expiresAt) {

    @Override
    public String toString() {
        return "GitHubInstallationToken[expiresAt=" + expiresAt + "]";
    }
}
