package com.example.starter_project_2025.system.schedule.session_audit.entity;

import com.example.starter_project_2025.system.schedule.session_audit.SessionAuditAction;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * T2 — Audit log (UFR-SYS-014, NFR-AUD).
 *
 * <p>Nhật ký kiểm toán bất biến: actor, hành động, đối tượng, before/after, lý do,
 * thời gian, correlation ID. Bảng này chỉ được ghi thêm (append-only), không có
 * API cập nhật/xóa.</p>
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "session_audit_log",
        indexes = {
                @Index(name = "idx_session_audit_entity", columnList = "entity_type,entity_id"),
                @Index(name = "idx_session_audit_created_at", columnList = "created_at"),
                @Index(name = "idx_session_audit_correlation", columnList = "correlation_id")
        },
        uniqueConstraints = @UniqueConstraint(
                name = "uk_session_audit_idempotency",
                columnNames = "idempotency_key")
)
public class SessionAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    /** Actor (user id) thực hiện thay đổi. */
    @Column(name = "actor_id", nullable = false)
    Long actorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 60)
    SessionAuditAction action;

    @Column(name = "entity_type", nullable = false, length = 60)
    String entityType;

    @Column(name = "entity_id", nullable = false)
    Long entityId;

    /** Snapshot JSON trước khi thay đổi. */
    @Column(name = "before_state", columnDefinition = "TEXT")
    String beforeState;

    /** Snapshot JSON sau khi thay đổi. */
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
