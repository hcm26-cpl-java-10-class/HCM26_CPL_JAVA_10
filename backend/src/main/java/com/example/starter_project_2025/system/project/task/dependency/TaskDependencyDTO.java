package com.example.starter_project_2025.system.project.task.dependency;

import com.example.starter_project_2025.system.project.task.TaskStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record TaskDependencyDTO(UUID taskId, String title, TaskStatus status,
                                String dependencyType, LocalDateTime createdAt) {
}
