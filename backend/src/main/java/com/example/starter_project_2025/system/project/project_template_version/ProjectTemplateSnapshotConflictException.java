package com.example.starter_project_2025.system.project.project_template_version;

import lombok.Getter;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * State conflict for the project template version use case: the same
 * {@code version} already exists for the selected template.
 * <p>
 * Handled by {@link ProjectTemplateSnapshotController} and translated into
 * {@code 409 Conflict}.
 */
@Getter
public class ProjectTemplateSnapshotConflictException extends RuntimeException {

    public static final String DEFAULT_MESSAGE =
            "Phiên bản này đã tồn tại cho Project Template đã chọn";

    private final Map<String, List<String>> errors;

    public ProjectTemplateSnapshotConflictException(String message) {
        super(message);
        this.errors = Collections.emptyMap();
    }

    public ProjectTemplateSnapshotConflictException(String field, String message) {
        super(message);
        this.errors = Map.of(field, List.of(message));
    }

    public static ProjectTemplateSnapshotConflictException duplicateVersion() {
        return new ProjectTemplateSnapshotConflictException("version", DEFAULT_MESSAGE);
    }
}
