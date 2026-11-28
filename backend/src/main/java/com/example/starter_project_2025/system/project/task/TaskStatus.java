package com.example.starter_project_2025.system.project.task;

import java.util.List;

public enum TaskStatus {
    TODO,
    IN_PROGRESS,
    REVIEW,
    DONE;

    public List<TaskStatus> nextStatuses() {
        return switch (this) {
            case TODO -> List.of(IN_PROGRESS);
            case IN_PROGRESS -> List.of(TODO, REVIEW);
            case REVIEW -> List.of(IN_PROGRESS, DONE);
            case DONE -> List.of(REVIEW);
        };
    }
}
