package com.example.starter_project_2025.system.schedule.session_audit.repository;

import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * Truy vấn/export audit log (UFR-SYS-014) — append-only.
 */
public interface SessionAuditLogRepository
        extends JpaRepository<SessionAuditLog, Long>, JpaSpecificationExecutor<SessionAuditLog> {
}
