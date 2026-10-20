package com.example.starter_project_2025.system.schedule.session_audit.entity;

import com.example.starter_project_2025.system.schedule.session.SessionStatus;
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
 * T2 / US-F15-02 — {@code session_status_history} (BR-SES-07).
 *
 * <p>Bản ghi lịch sử chuyển trạng thái là <b>bất biến, append-only</b>: chỉ có getter,
 * không có API sửa/xóa. Mỗi lần chuyển trạng thái thành công tạo đúng một dòng
 * (from → to, reason, changed_by, changed_at, correlation_id).</p>
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "session_status_history",
        indexes = {
                @Index(name = "idx_session_history_changed_at", columnList = "session_id,changed_at"),
                @Index(name = "idx_session_history_correlation", columnList = "correlation_id")
        },
        uniqueConstraints = @UniqueConstraint(
                name = "uk_session_history_idempotency",
                columnNames = "idempotency_key")
)
public class SessionStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "session_id", nullable = false)
    Long sessionId;

    /** Trạng thái trước khi chuyển (null nếu đây là dòng khởi tạo). */
    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 30)
    SessionStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 30)
    SessionStatus toStatus;

    /** Lý do chuyển trạng thái (bắt buộc với CANCELLED — BR-SES-03). */
    @Column(name = "reason", length = 500)
    String reason;

    @Column(name = "changed_by", nullable = false)
    Long changedBy;

    @Column(name = "changed_at", nullable = false)
    LocalDateTime changedAt;

    /** Correlation ID của request gây ra thay đổi (SRS §8.1, NFR-OBS). */
    @Column(name = "correlation_id", length = 100)
    String correlationId;

    /** Khóa chống lặp: một Idempotency-Key chỉ sinh tối đa một dòng history (BR-SES-07). */
    @Column(name = "idempotency_key", length = 120)
    String idempotencyKey;
}
