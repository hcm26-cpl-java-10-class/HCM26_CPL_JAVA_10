package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.sprint.TaskStatus;

import java.time.LocalDateTime;

public record TaskStatusHistoryResponse(
        Long id,
        TaskStatus previousStatus,
        TaskStatus newStatus,
        Long previousVersion,
        Long newVersion,
        Long actorId,
        String actorDisplayName,
        String correlationId,
        LocalDateTime occurredAt
) {
}
