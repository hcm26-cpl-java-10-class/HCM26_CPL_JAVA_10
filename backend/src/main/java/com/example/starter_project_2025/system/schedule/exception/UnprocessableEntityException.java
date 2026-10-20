package com.example.starter_project_2025.system.schedule.exception;

import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * Lỗi validation nghiệp vụ (HTTP 422 VALIDATION_FAILED) — dùng cho F15 (schedule/session).
 *
 * <p>Trả kèm {@code fieldErrors} dạng map (field -&gt; danh sách message), ví dụ
 * {@code fieldErrors.cancelReason}.</p>
 */
@Getter
public class UnprocessableEntityException extends RuntimeException {

    private final String code;
    private final Map<String, List<String>> fieldErrors;

    public UnprocessableEntityException(String code, Map<String, List<String>> fieldErrors, String message) {
        super(message);
        this.code = code;
        this.fieldErrors = fieldErrors;
    }

    public static UnprocessableEntityException of(String code, String field, String message) {
        return new UnprocessableEntityException(code, Map.of(field, List.of(message)), "Validation failed");
    }
}
