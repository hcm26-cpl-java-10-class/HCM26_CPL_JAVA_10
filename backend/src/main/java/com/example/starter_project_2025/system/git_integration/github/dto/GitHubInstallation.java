package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubInstallation(
        Long id,
        GitHubAccount account,
        @JsonProperty("app_id") Long appId,
        @JsonProperty("repository_selection") String repositorySelection,
        @JsonProperty("suspended_at") String suspendedAt) {

    public boolean suspended() {
        return suspendedAt != null && !suspendedAt.isBlank();
    }
}
