package com.example.starter_project_2025.system.git_integration.ingestion.model;

import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;

import java.time.LocalDateTime;

/** SY-04: a commit normalized from a push payload or the GitHub API, before it is stored. */
public record IncomingCommit(
        String sha,
        String message,
        String authorName,
        String authorEmail,
        String authorLogin,
        Long authorGithubId,
        String committerName,
        String committerEmail,
        String committerLogin,
        LocalDateTime authoredAt,
        LocalDateTime committedAt,
        String htmlUrl,
        Integer filesChanged,
        Integer parentCount,
        GitCommitSource source) {
}
