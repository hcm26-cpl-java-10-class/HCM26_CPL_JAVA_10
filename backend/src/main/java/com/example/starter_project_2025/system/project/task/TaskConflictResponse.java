package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.sprint.TaskStatus;

public record TaskConflictResponse(
        String message,
        Long currentVersion,
        TaskStatus currentStatus
) {
}
