package com.example.starter_project_2025.system.project.task.workflow;

import com.example.starter_project_2025.system.project.task.TaskStatus;

public record TaskStatusRequest(TaskStatus status, Long version) {
}
