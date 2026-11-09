package com.example.starter_project_2025.system.project.board;

import java.time.LocalDateTime;

public record ActivityItemResponse(
        Long id,
        Long actorId,
        String actorDisplayName,
        String actionType,
        String entityType,
        Long entityId,
        String beforeState,
        String afterState,
        String correlationId,
        LocalDateTime occurredAt
) {
}
