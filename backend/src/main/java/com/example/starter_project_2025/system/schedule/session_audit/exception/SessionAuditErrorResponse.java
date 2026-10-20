package com.example.starter_project_2025.system.schedule.session_audit.exception;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * T2 / AC T2-06 — Body lỗi có {@code correlationId} để client đối chiếu với log (NFR-OBS).
 *
 * <pre>{ "status": 422, "code": "VALIDATION_FAILED", "message": "...",
 *         "fieldErrors": {...}, "correlationId": "...", "timestamp": "..." }</pre>
 */
public record SessionAuditErrorResponse(
        int status,
        String code,
        String message,
        Map<String, List<String>> fieldErrors,
        String correlationId,
        LocalDateTime timestamp
) {
}
