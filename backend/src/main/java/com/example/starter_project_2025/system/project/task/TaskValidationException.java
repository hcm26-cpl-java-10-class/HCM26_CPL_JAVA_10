package com.example.starter_project_2025.system.project.task;

import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
public class TaskValidationException extends RuntimeException {
    private final Map<String, List<String>> errors;

    public TaskValidationException(Map<String, List<String>> errors) {
        super("Dữ liệu Task không hợp lệ");
        this.errors = errors;
    }

    public TaskValidationException(String field, String message) {
        this(Map.of(field, List.of(message)));
    }
}
