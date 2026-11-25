package com.example.starter_project_2025.system.git_integration.dto;

/** GI-04: small summaries placed in error {@code details} so the frontend can name what blocked a link. */
public final class GitLinkDetails {

    private GitLinkDetails() {
    }

    /** {@code code}/{@code name} are null when the project belongs to another tenant. */
    public record ProjectSummary(Long id, String code, String name) {
    }

    public record RepositorySummary(Long externalId, String fullName, String htmlUrl, String defaultBranch) {
    }
}
