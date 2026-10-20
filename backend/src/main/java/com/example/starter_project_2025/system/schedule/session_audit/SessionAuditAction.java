package com.example.starter_project_2025.system.schedule.session_audit;

/**
 * Hành động được ghi vào audit log (NFR-AUD).
 */
public enum SessionAuditAction {

    /** Đổi trạng thái buổi học kèm/không kèm notes. */
    SESSION_STATUS_CHANGE,

    /** Chỉ cập nhật notes (không đổi trạng thái). */
    SESSION_NOTES_UPDATE
}
