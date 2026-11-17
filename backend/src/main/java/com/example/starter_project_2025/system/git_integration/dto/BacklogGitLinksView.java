package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;

import java.util.List;

/**
 * SY-05 Task Detail: the commits and pull requests linked to one task.
 * {@code repository} is the repository of the task's master project (null when none is linked).
 */
public record BacklogGitLinksView(
        Long itemId,
        String taskKey,
        RepositoryRef repository,
        List<GitPullRequestItem> pullRequests,
        GitPage<GitCommitItem> commits,
        long commitCount,
        long pullRequestCount) {

    public record RepositoryRef(Long id, String fullName, String htmlUrl, GitRepositoryStatus status) {
    }
}
