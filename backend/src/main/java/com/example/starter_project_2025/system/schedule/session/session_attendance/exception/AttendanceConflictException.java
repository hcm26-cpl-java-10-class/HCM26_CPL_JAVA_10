package com.example.starter_project_2025.system.schedule.session.session_attendance.exception;

import lombok.Getter;

/**
 * T1 / AC T1-02, T1-04, T1-06 — Lỗi xung đột trạng thái/phiên bản (HTTP 409).
 *
 * <p>{@code currentVersion} được trả kèm khi xung đột phiên bản hoặc trùng bản ghi để FE
 * quyết định reload/merge (SCR-53).</p>
 */
@Getter
public class AttendanceConflictException extends RuntimeException {

    private final String code;
    private final Long currentVersion;

    public AttendanceConflictException(String code, String message) {
        this(code, message, null);
    }

    public AttendanceConflictException(String code, String message, Long currentVersion) {
        super(message);
        this.code = code;
        this.currentVersion = currentVersion;
    }
}
