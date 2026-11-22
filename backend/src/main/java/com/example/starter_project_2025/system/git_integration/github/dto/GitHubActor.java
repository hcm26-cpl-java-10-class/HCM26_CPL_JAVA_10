package com.example.starter_project_2025.system.git_integration.github.dto;

/** SY-02: a GitHub account (user or bot) as GraphQL returns it; NULL fields for a deleted ("ghost") account. */
public record GitHubActor(String login, Long databaseId) {
}
