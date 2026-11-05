package com.example.starter_project_2025.system.project.project_template_version;

import lombok.Getter;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Business validation failure for the project template version use case.
 * <p>
 * Handled by {@link ProjectTemplateSnapshotController} and translated into
 * {@code 422 Unprocessable Entity} with a per-field error map so the UI can
 * highlight the offending inputs while keeping the rest of the form data.
 */
@Getter
public class ProjectTemplateSnapshotValidationException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public ProjectTemplateSnapshotValidationException(Map<String, List<String>> errors) {
        super("Dữ liệu phiên bản Project Template không hợp lệ");
        this.errors = errors == null ? Collections.emptyMap() : new LinkedHashMap<>(errors);
    }

    public ProjectTemplateSnapshotValidationException(String field, String message) {
        super(message);
        this.errors = Map.of(field, List.of(message));
    }
}
