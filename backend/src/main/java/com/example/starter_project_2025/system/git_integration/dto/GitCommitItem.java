package com.example.starter_project_2025.system.git_integration.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * SY-04: a stored commit; {@code headline} is the first line of the message, {@code branch} the first-seen ref without refs/heads/.
 * SY-05: {@code merge} for a commit with several parents, {@code taskRefs} the Task IDs it mentions and their verdict.
 */
public record GitCommitItem(
        Long id,
        String sha,
        String shortSha,
        String headline,
        String message,
        String authorName,
        String authorLogin,
        LocalDateTime committedAt,
        String htmlUrl,
        String branch,
        Integer filesChanged,
        boolean merge,
        List<GitTaskRef> taskRefs) {
}
