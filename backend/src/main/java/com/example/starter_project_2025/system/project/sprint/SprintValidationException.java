package com.example.starter_project_2025.system.project.sprint;

import lombok.Getter;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Business validation failure for the sprint use case (UFR-PRJ-003-01, AC02).
 * <p>
 * Handled by {@link SprintController} and translated into
 * {@code 422 Unprocessable Entity} with a per-field error map so the UI can
 * highlight the offending inputs while keeping the rest of the form data.
 */
@Getter
public class SprintValidationException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public SprintValidationException(Map<String, List<String>> errors) {
        super("Dữ liệu Sprint không hợp lệ");
        this.errors = errors == null ? Collections.emptyMap() : new LinkedHashMap<>(errors);
    }

    public SprintValidationException(String field, String message) {
        super(message);
        this.errors = Map.of(field, List.of(message));
    }
}
