package com.example.starter_project_2025.system.git_integration.github.dto;

import java.util.List;

/**
 * SY-02: a pull request of the GraphQL list, with the first page of its submitted reviews
 * ({@code reviewsHasNextPage} / {@code reviewsEndCursor} to read the rest through {@code nodeId}).
 */
public record GitHubPullRequestNode(
        String nodeId,
        Long databaseId,
        int number,
        String title,
        String body,
        String url,
        String state,
        boolean merged,
        boolean draft,
        String createdAt,
        String updatedAt,
        String closedAt,
        String mergedAt,
        String headRefName,
        String headRefOid,
        String baseRefName,
        Integer additions,
        Integer deletions,
        Integer changedFiles,
        Integer commitsCount,
        String mergeCommitOid,
        String mergedByLogin,
        GitHubActor author,
        List<GitHubReviewNode> reviews,
        boolean reviewsHasNextPage,
        String reviewsEndCursor) {
}
