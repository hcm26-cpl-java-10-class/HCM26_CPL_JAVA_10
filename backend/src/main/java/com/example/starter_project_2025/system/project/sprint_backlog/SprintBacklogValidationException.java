package com.example.starter_project_2025.system.project.sprint_backlog;

import lombok.Getter;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Business validation failure for the Sprint Backlog use case.
 * <p>
 * Handled by {@link SprintBacklogController} and translated into
 * {@code 422 Unprocessable Entity} with a per-field error map so the UI can
 * highlight the offending inputs while keeping the rest of the form data.
 */
@Getter
public class SprintBacklogValidationException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public SprintBacklogValidationException(Map<String, List<String>> errors) {
        super("Dữ liệu Sprint Backlog không hợp lệ");
        this.errors = errors == null ? Collections.emptyMap() : new LinkedHashMap<>(errors);
    }

    public SprintBacklogValidationException(String field, String message) {
        super(message);
        this.errors = Map.of(field, List.of(message));
    }
}
