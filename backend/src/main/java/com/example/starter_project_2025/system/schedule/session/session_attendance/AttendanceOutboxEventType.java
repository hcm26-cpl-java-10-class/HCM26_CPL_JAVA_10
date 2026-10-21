package com.example.starter_project_2025.system.schedule.session.session_attendance;

/**
 * T1 / UFR-COM — Loại sự kiện phát ra outbox (một lần duy nhất cho mỗi thay đổi bản ghi).
 */
public enum AttendanceOutboxEventType {
    ATTENDANCE_RECORDED,
    ATTENDANCE_UPDATED,
    ATTENDANCE_CORRECTED
}
