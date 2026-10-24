package com.example.starter_project_2025.system.project.backlog_temp;

import lombok.Getter;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Business validation failure of the backlog item use case
 * (UFR-PRJ-003-02, AC02).
 * <p>
 * Translated into {@code 422 Unprocessable Entity} by {@link TaskController}
 * together with a per-field error map, so the form can highlight the offending
 * inputs without losing the other values the user already typed.
 */
@Getter
public class TaskValidationException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public TaskValidationException(Map<String, List<String>> errors) {
        super("Dữ liệu Backlog item không hợp lệ");
        this.errors = errors == null ? Collections.emptyMap() : new LinkedHashMap<>(errors);
    }

    public TaskValidationException(String field, String message) {
        super(message);
        this.errors = Map.of(field, List.of(message));
    }
}
