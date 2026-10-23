package com.example.starter_project_2025.system.project.sprint;

import lombok.Getter;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * State conflict for the sprint use case (UFR-PRJ-003-01, AC03): duplicate
 * sprint name, or a stale write detected by optimistic locking.
 * <p>
 * Handled by {@link SprintController} and translated into {@code 409 Conflict}.
 */
@Getter
public class SprintConflictException extends RuntimeException {

    public static final String DEFAULT_MESSAGE =
            "Tên Sprint đã tồn tại hoặc dữ liệu đã bị thay đổi, vui lòng tải lại trang";

    private final Map<String, List<String>> errors;

    public SprintConflictException(String message) {
        super(message);
        this.errors = Collections.emptyMap();
    }

    public SprintConflictException(String field, String message) {
        super(message);
        this.errors = Map.of(field, List.of(message));
    }

    public static SprintConflictException duplicateName() {
        return new SprintConflictException("name", DEFAULT_MESSAGE);
    }

    public static SprintConflictException staleVersion() {
        return new SprintConflictException(DEFAULT_MESSAGE);
    }
}
