package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Owner of an installation: a user or an organization. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubAccount(Long id, String login, String type) {
}
