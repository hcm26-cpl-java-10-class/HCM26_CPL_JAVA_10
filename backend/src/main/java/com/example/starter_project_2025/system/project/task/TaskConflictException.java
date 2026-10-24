package com.example.starter_project_2025.system.project.task;

public class TaskConflictException extends RuntimeException {
    public static final String STALE_MESSAGE =
            "This task was changed by another member. Please reload the page.";

    public TaskConflictException(String message) {
        super(message);
    }
}
