package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Response of GET /user/installations. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubUserInstallationsPage(
        @JsonProperty("total_count") Integer totalCount,
        List<GitHubInstallation> installations) {
}
