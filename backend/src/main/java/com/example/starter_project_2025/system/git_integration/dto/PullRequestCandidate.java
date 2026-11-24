package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;

import java.time.LocalDateTime;
import java.util.List;

/**
 * TM-03 link picker: a pull request of the task's repository. {@code linkedTaskKeys} are
 * other tasks it is on (at most 3) that the caller may open.
 */
public record PullRequestCandidate(
        Long id,
        int number,
        String title,
        GitPullRequestState state,
        boolean draft,
        String authorLogin,
        LocalDateTime updatedAt,
        boolean alreadyLinked,
        List<String> linkedTaskKeys) {
}
