package com.example.starter_project_2025.system.schedule.session.session_attendance;

/**
 * T1 — Trạng thái phát của outbox event (transactional outbox pattern).
 */
public enum AttendanceOutboxStatus {
    PENDING,
    PUBLISHED,
    FAILED
}
