package com.example.starter_project_2025.system.schedule.session.session_attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** T1 / UFR-SYS-014 — Audit log điểm danh (append-only). */
public interface AttendanceAuditLogRepository
        extends JpaRepository<AttendanceAuditLog, Long>, JpaSpecificationExecutor<AttendanceAuditLog> {

    long countByEntityTypeAndEntityId(String entityType, Long entityId);
}
