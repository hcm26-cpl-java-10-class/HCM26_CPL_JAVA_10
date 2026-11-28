package com.example.starter_project_2025.system.project.sprint_backlog;

import lombok.Getter;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * State conflict for the Sprint Backlog use case: a stale write detected by
 * optimistic locking.
 * <p>
 * Handled by {@link SprintBacklogController} and translated into
 * {@code 409 Conflict}.
 */
@Getter
public class SprintBacklogConflictException extends RuntimeException {

    public static final String DEFAULT_MESSAGE =
            "Dữ liệu Sprint Backlog đã bị thay đổi, vui lòng tải lại trang";

    private final Map<String, List<String>> errors;

    public SprintBacklogConflictException(String message) {
        super(message);
        this.errors = Collections.emptyMap();
    }

    public SprintBacklogConflictException(String field, String message) {
        super(message);
        this.errors = Map.of(field, List.of(message));
    }

    public static SprintBacklogConflictException staleVersion() {
        return new SprintBacklogConflictException(DEFAULT_MESSAGE);
    }
}
