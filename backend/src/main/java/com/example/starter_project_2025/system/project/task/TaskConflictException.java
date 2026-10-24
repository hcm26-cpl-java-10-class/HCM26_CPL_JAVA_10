package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.sprint.TaskStatus;
import lombok.Getter;

@Getter
public class TaskConflictException extends RuntimeException {

    private final Long currentVersion;
    private final TaskStatus currentStatus;

    public TaskConflictException(String message, Long currentVersion, TaskStatus currentStatus) {
        super(message);
        this.currentVersion = currentVersion;
        this.currentStatus = currentStatus;
    }
}
