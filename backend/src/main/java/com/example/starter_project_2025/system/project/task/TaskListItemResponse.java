package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.board.TaskCardResponse;
import com.example.starter_project_2025.system.project.sprint.TaskPriority;
import com.example.starter_project_2025.system.project.sprint.TaskStatus;

public record TaskListItemResponse(
        Long id,
        String code,
        String title,
        TaskStatus status,
        TaskCardResponse.AssigneeResponse assignee,
        TaskPriority priority,
        Long version
) {
}
