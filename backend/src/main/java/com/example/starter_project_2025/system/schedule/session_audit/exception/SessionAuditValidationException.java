package com.example.starter_project_2025.system.schedule.session_audit.exception;

import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * T2 — 422 VALIDATION_FAILED cho module notes/audit.
 *
 * <p>Trả kèm {@code fieldErrors} dạng map (field → danh sách message), ví dụ
 * {@code fieldErrors.notes} hoặc {@code fieldErrors.updatedBy}.</p>
 */
@Getter
public class SessionAuditValidationException extends RuntimeException {

    private final String code;
    private final Map<String, List<String>> fieldErrors;

    public SessionAuditValidationException(String code, Map<String, List<String>> fieldErrors, String message) {
        super(message);
        this.code = code;
        this.fieldErrors = fieldErrors;
    }

    public static SessionAuditValidationException of(String field, String message) {
        return new SessionAuditValidationException(
                "VALIDATION_FAILED",
                Map.of(field, List.of(message)),
                "Validation failed");
    }
}
