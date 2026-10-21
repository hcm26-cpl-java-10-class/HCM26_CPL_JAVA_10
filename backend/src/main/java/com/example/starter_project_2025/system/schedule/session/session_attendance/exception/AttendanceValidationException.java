package com.example.starter_project_2025.system.schedule.session.session_attendance.exception;

import com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes;
import lombok.Getter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * T1 / AC T1-03 — Lỗi dữ liệu nghiệp vụ (HTTP 422) kèm {@code fieldErrors}.
 *
 * <p>Dùng cho {@code VALIDATION_FAILED} và các mã 422 đặc thù như
 * {@code SESSION_DATE_IN_FUTURE}, {@code STUDENT_NOT_IN_CLASS}, {@code STUDENT_NOT_ACTIVE}.</p>
 */
@Getter
public class AttendanceValidationException extends RuntimeException {

    private final String code;
    private final Map<String, List<String>> fieldErrors;

    public AttendanceValidationException(String code, Map<String, List<String>> fieldErrors, String message) {
        super(message);
        this.code = code;
        this.fieldErrors = fieldErrors == null ? Map.of() : fieldErrors;
    }

    public static AttendanceValidationException of(String field, String message) {
        return new AttendanceValidationException(
                AttendanceCodes.VALIDATION_FAILED,
                Map.of(field, List.of(message)),
                "Validation failed");
    }

    public static AttendanceValidationException ofCode(String code, String field, String message) {
        return new AttendanceValidationException(code, Map.of(field, List.of(message)), message);
    }

    /** Gộp nhiều lỗi field (giữ thứ tự xuất hiện để FE hiển thị ổn định). */
    public static AttendanceValidationException ofFields(Map<String, List<String>> fieldErrors, String message) {
        return new AttendanceValidationException(
                AttendanceCodes.VALIDATION_FAILED,
                new LinkedHashMap<>(fieldErrors),
                message);
    }
}
