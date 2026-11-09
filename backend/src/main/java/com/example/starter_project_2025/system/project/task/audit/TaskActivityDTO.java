package com.example.starter_project_2025.system.project.task.audit;

import com.example.starter_project_2025.system.project.task.TaskDTO;

import java.time.LocalDateTime;
import java.util.UUID;

public record TaskActivityDTO(UUID id, String action, Long actorId, String actorName,
                              LocalDateTime occurredAt, TaskDTO before, TaskDTO after) {
}
