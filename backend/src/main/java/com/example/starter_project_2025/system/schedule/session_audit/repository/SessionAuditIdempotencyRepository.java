package com.example.starter_project_2025.system.schedule.session_audit.repository;

import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionAuditIdempotencyRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SessionAuditIdempotencyRepository
        extends JpaRepository<SessionAuditIdempotencyRecord, Long> {

    Optional<SessionAuditIdempotencyRecord> findByIdempotencyKey(String idempotencyKey);
}
