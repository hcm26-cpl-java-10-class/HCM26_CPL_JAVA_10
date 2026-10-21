package com.example.starter_project_2025.system.schedule.session.session_attendance.exception;

import lombok.Getter;

/**
 * T1 / AC T1-3 mục 8 — Tài nguyên không tồn tại hoặc khác tenant (HTTP 404).
 *
 * <p>Message luôn trung tính để không lộ sự tồn tại của tài nguyên ngoài phạm vi.</p>
 */
@Getter
public class AttendanceNotFoundException extends RuntimeException {

    private final String code;

    public AttendanceNotFoundException(String code, String message) {
        super(message);
        this.code = code;
    }

    public static AttendanceNotFoundException attendance(Long id) {
        return new AttendanceNotFoundException(
                "ATTENDANCE_NOT_FOUND",
                "Attendance record not found: id=" + id + ".");
    }

    public static AttendanceNotFoundException session(Long sessionId) {
        return new AttendanceNotFoundException(
                "SESSION_NOT_FOUND",
                "Session not found: id=" + sessionId + ".");
    }
}
