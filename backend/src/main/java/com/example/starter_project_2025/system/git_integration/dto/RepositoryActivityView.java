package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;

import java.time.LocalDateTime;
import java.util.List;

/**
 * SY-04: summary of the data synchronized for a project's repository.
 * {@code repositoryId} is null (and every count 0) when no repository is linked.
 * <p>
 * GI-05: {@code repositoryId} / {@code repositoryStatus} and the webhook health are the current
 * repository's (null when every repository was unlinked); the counts and the last commit cover
 * every repository the project ever linked, listed in {@code repositories}.
 */
public record RepositoryActivityView(
        Long repositoryId,
        GitRepositoryStatus repositoryStatus,
        long commitCount,
        long linkedCommitCount,
        GitCommitItem lastCommit,
        PullRequestCounts pullRequests,
        LocalDateTime lastEventAt,
        long pendingEvents,
        long failedEvents,
        List<GitRepositoryLabel> repositories) {

    public record PullRequestCounts(long open, long merged, long closed) {
        public static final PullRequestCounts NONE = new PullRequestCounts(0, 0, 0);
    }

    public static RepositoryActivityView none() {
        return new RepositoryActivityView(null, null, 0, 0, null, PullRequestCounts.NONE, null, 0, 0, List.of());
    }
}
