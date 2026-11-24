package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Branch as returned by GET /repos/{owner}/{repo}/branches (only the fields the platform uses). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubBranch(String name, @JsonProperty("protected") Boolean protectedBranch) {
}
