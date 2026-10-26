package com.example.starter_project_2025.system.project.board;

import com.example.starter_project_2025.system.project.sprint.TaskPriority;
import com.example.starter_project_2025.system.project.sprint.TaskStatus;

public record TaskCardResponse(
        Long id,
        String code,
        String title,
        AssigneeResponse assignee,
        TaskPriority priority,
        TaskStatus status,
        Long version,
        Long sprintId
) {
    public record AssigneeResponse(Long id, String displayName) {
    }
}
