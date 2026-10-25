package com.example.starter_project_2025.system.project.task;

import java.util.List;
import java.util.Map;

public class TaskValidationException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public TaskValidationException(String field, String message) {
        this(Map.of(field, List.of(message)));
    }

    public TaskValidationException(Map<String, List<String>> errors) {
        super("Task validation failed");
        this.errors = Map.copyOf(errors);
    }

    public Map<String, List<String>> getErrors() {
        return errors;
    }
}