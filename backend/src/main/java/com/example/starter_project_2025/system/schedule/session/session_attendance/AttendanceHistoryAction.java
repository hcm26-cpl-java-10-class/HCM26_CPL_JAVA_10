package com.example.starter_project_2025.system.schedule.session.session_attendance;

/**
 * T1 / BR-ATT-04 — Loại thao tác của một dòng lịch sử thay đổi (append-only).
 */
public enum AttendanceHistoryAction {
    /** Ghi mới bản ghi điểm danh. */
    CREATE,
    /** Cập nhật thông thường khi lớp còn ONGOING. */
    UPDATE,
    /** Sửa sau khi lớp COMPLETED — cần quyền unlock + lý do (BR-ATT-03). */
    CORRECTION
}
