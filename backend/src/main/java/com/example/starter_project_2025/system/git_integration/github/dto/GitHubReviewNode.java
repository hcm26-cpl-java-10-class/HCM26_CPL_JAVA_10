package com.example.starter_project_2025.system.git_integration.github.dto;

/** SY-02: a submitted review of a pull request (GraphQL); dates are ISO-8601 as GitHub returns them. */
public record GitHubReviewNode(
        Long databaseId,
        String state,
        String body,
        String url,
        String submittedAt,
        String updatedAt,
        String commitOid,
        GitHubActor author) {
}
