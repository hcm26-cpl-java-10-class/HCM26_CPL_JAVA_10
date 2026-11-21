package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubUser(Long id, String login, @JsonProperty("avatar_url") String avatarUrl) {

    public GitHubUser(Long id, String login) {
        this(id, login, null);
    }
}
