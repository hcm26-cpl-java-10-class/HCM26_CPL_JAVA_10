package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;

import java.time.LocalDateTime;
import java.util.List;

/** SY-04: a pull request in a list, with the current review decision of each reviewer counted once. */
public record GitPullRequestItem(
        Long id,
        int number,
        String title,
        GitPullRequestState state,
        boolean draft,
        String authorLogin,
        String headRef,
        String baseRef,
        String htmlUrl,
        Integer additions,
        Integer deletions,
        Integer changedFiles,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime mergedAt,
        LocalDateTime closedAt,
        ReviewSummary reviewSummary,
        List<GitTaskRef> taskRefs) {

    public record ReviewSummary(int approved, int changesRequested, int commented) {
        public static final ReviewSummary NONE = new ReviewSummary(0, 0, 0);
    }
}
