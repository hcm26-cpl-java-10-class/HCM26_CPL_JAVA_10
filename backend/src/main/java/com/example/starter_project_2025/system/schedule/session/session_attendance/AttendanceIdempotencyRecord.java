package com.example.starter_project_2025.system.schedule.session.session_attendance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * T1 / AC T1-06 &amp; BR-UNI-20 — Lưu kết quả request theo {@code Idempotency-Key}.
 *
 * <p>Lần gửi lặp trả lại đúng response cũ và <b>không</b> tạo thêm bản ghi/history/outbox.
 * Cùng key nhưng payload khác ⇒ 409 {@code IDEMPOTENCY_KEY_REUSED}. Vì vậy bảng có unique
 * constraint trên {@code idempotency_key}.</p>
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "attendance_idempotency",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_attendance_idempotency_key",
                columnNames = "idempotency_key"),
        indexes = @Index(name = "idx_attendance_idempotency_created", columnList = "created_at"))
public class AttendanceIdempotencyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "idempotency_key", nullable = false, length = 120)
    String idempotencyKey;

    /** CREATE | UPDATE | BULK — để phát hiện key bị dùng lại cho endpoint khác. */
    @Column(name = "scope", nullable = false, length = 20)
    String scope;

    @Column(name = "attendance_id")
    Long attendanceId;

    @Column(name = "session_id")
    Long sessionId;

    /** Vân tay SHA-256 của payload + tham số đường dẫn. */
    @Column(name = "request_fingerprint", nullable = false, length = 64)
    String requestFingerprint;

    /** Response JSON đã trả cho client ở lần đầu (kèm HTTP status). */
    @Column(name = "response_payload", columnDefinition = "TEXT", nullable = false)
    String responsePayload;

    @Column(name = "response_status", nullable = false)
    Integer responseStatus;

    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt;
}
