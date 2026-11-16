package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Response of GET /installation/repositories. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubInstallationRepositoriesPage(
        @JsonProperty("total_count") Integer totalCount,
        List<GitHubRepository> repositories) {
}
