package com.example.starter_project_2025.system.project.developmentinsights.dto;

import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Page;

public final class GitUnmappedActivityDtos {
    private GitUnmappedActivityDtos() { }

    public enum ActivityType { COMMIT, PULL_REQUEST, ALL }

    public record Item(ActivityType type, Long id, Integer number, String sha, String title,
                       String authorName, String authorLogin, String state,
                       String reason, Instant occurredAt, String htmlUrl) { }

    public record TaskOption(Long id, Long projectId, String projectName, String title) { }

    public record LinkInput(ActivityType type, Long activityId, Long taskId) { }

    public record LinkResult(Long taskLinkId, ActivityType type, Long activityId,
                             Long taskId, Long projectId, TaskGitLinkSource source,
                             Instant linkedAt, String linkedBy) { }

    public record UnmappedPage(Page<Item> activities, boolean canManage) { }

    public record TaskOptions(List<TaskOption> tasks) { }
}
