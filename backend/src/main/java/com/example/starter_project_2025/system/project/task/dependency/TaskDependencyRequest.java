package com.example.starter_project_2025.system.project.task.dependency;

import java.util.UUID;

public record TaskDependencyRequest(UUID predecessorTaskId, Long version) {
}
