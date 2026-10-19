package com.example.starter_project_2025.system.schedule.exception;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Error body thống nhất cho các lỗi trạng thái mới của schedule/session (409 / 422).
 *
 * <pre>{ "status": 422, "code": "VALIDATION_FAILED", "message": "...", "fieldErrors": {...}, "timestamp": "..." }</pre>
 */
public record ApiErrorResponse(
        int status,
        String code,
        String message,
        Map<String, List<String>> fieldErrors,
        LocalDateTime timestamp
) {
}
