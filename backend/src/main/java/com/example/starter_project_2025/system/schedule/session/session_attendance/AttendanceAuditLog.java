package com.example.starter_project_2025.system.schedule.session.session_attendance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * T1 / UFR-SYS-014 (NFR-AUD) — Audit log của module điểm danh (append-only).
 *
 * <p>Ghi actor, hành động, đối tượng, before/after (JSON), lý do, correlation ID và
 * Idempotency-Key. Không có API cập nhật/xóa.</p>
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "attendance_audit_log",
        indexes = {
                @Index(name = "idx_attendance_audit_entity", columnList = "entity_type,entity_id"),
                @Index(name = "idx_attendance_audit_created_at", columnList = "created_at"),
                @Index(name = "idx_attendance_audit_correlation", columnList = "correlation_id")
        })
public class AttendanceAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "actor_id", nullable = false)
    Long actorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 40)
    AttendanceAuditAction action;

    @Column(name = "entity_type", nullable = false, length = 40)
    String entityType;

    @Column(name = "entity_id", nullable = false)
    Long entityId;

    @Column(name = "before_state", columnDefinition = "TEXT")
    String beforeState;

    @Column(name = "after_state", columnDefinition = "TEXT")
    String afterState;

    @Column(name = "reason", length = 500)
    String reason;

    @Column(name = "correlation_id", length = 100)
    String correlationId;

    @Column(name = "idempotency_key", length = 120)
    String idempotencyKey;

    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt;
}
