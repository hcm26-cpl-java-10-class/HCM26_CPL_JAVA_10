package com.example.starter_project_2025.system.schedule.session.session_attendance.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * T1 / AC T1-03, T1-04, T1-06 — Body lỗi thống nhất của module điểm danh.
 *
 * <pre>{ "status": 409, "code": "ATTENDANCE_VERSION_CONFLICT", "message": "...",
 *         "fieldErrors": null, "currentVersion": 3,
 *         "correlationId": "...", "timestamp": "..." }</pre>
 */
public record AttendanceErrorResponse(
        int status,
        String code,
        String message,
        Map<String, List<String>> fieldErrors,
        Long currentVersion,
        String correlationId,
        LocalDateTime timestamp
) {
}
