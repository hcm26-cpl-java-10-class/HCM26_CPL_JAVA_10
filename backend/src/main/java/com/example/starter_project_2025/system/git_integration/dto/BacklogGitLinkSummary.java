package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;

/** SY-05: link counts of one task, for the badges of the Backlog and Kanban boards. */
public record BacklogGitLinkSummary(
        Long itemId,
        long commitCount,
        long pullRequestCount,
        Integer latestPullRequestNumber,
        GitPullRequestState latestPullRequestState) {
}
