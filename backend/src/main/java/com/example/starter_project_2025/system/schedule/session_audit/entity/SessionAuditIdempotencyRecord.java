package com.example.starter_project_2025.system.schedule.session_audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
 * T2 / AC T2-04 — Lưu kết quả của request theo {@code Idempotency-Key} để lần gửi lặp
 * trả lại đúng kết quả cũ và <b>không</b> sinh thêm dòng history/audit thứ hai.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "session_audit_idempotency",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_session_audit_idempotency_key",
                columnNames = "idempotency_key")
)
public class SessionAuditIdempotencyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "idempotency_key", nullable = false, length = 120)
    String idempotencyKey;

    @Column(name = "session_id", nullable = false)
    Long sessionId;

    /** Vân tay (SHA-256) của payload — cùng key nhưng payload khác ⇒ 409. */
    @Column(name = "request_fingerprint", nullable = false, length = 64)
    String requestFingerprint;

    /** Response JSON đã trả cho client ở lần đầu. */
    @Column(name = "response_payload", columnDefinition = "TEXT", nullable = false)
    String responsePayload;

    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt;
}
