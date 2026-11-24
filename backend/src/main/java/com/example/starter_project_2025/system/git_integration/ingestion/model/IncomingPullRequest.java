package com.example.starter_project_2025.system.git_integration.ingestion.model;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;

import java.time.LocalDateTime;

/** SY-04: a pull request normalized from a {@code pull_request} object of a webhook payload. */
public record IncomingPullRequest(
        Long externalId,
        int number,
        String title,
        String body,
        GitPullRequestState state,
        boolean draft,
        String authorLogin,
        Long authorGithubId,
        String headRef,
        String headSha,
        String baseRef,
        String mergeCommitSha,
        String mergedByLogin,
        Integer commitsCount,
        Integer additions,
        Integer deletions,
        Integer changedFiles,
        String htmlUrl,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime closedAt,
        LocalDateTime mergedAt) {
}
