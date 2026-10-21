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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * T1 / UFR-COM — Transactional outbox event cho module điểm danh.
 *
 * <p>{@code dedupKey} là duy nhất nên mỗi thay đổi bản ghi chỉ phát <b>đúng một</b> sự kiện,
 * kể cả khi request được gửi lặp với cùng {@code Idempotency-Key}.</p>
 *
 * <p>Producer/consumer thật nằm ngoài phạm vi T1; module chỉ đảm bảo sự kiện được ghi
 * cùng transaction với dữ liệu (không mất, không trùng).</p>
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "attendance_outbox_event",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_attendance_outbox_dedup",
                columnNames = "dedup_key"),
        indexes = {
                @Index(name = "idx_attendance_outbox_status", columnList = "status,occurred_at"),
                @Index(name = "idx_attendance_outbox_aggregate", columnList = "aggregate_type,aggregate_id")
        })
public class AttendanceOutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 40)
    AttendanceOutboxEventType eventType;

    @Column(name = "aggregate_type", nullable = false, length = 40)
    String aggregateType;

    @Column(name = "aggregate_id", nullable = false)
    Long aggregateId;

    /** Payload JSON của sự kiện. */
    @Column(name = "payload", columnDefinition = "TEXT")
    String payload;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    AttendanceOutboxStatus status;

    /** Khóa chống phát trùng — {@code <eventType>:<attendanceId>:<version>}. */
    @Column(name = "dedup_key", nullable = false, length = 160)
    String dedupKey;

    @Column(name = "correlation_id", length = 100)
    String correlationId;

    @Column(name = "occurred_at", nullable = false)
    LocalDateTime occurredAt;

    @Column(name = "published_at")
    LocalDateTime publishedAt;

    @Builder.Default
    @Column(name = "attempts", nullable = false)
    Integer attempts = 0;
}
