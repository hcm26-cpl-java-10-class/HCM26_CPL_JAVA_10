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
 * T1 / BR-ATT-04 — Lịch sử thay đổi của bản ghi điểm danh, <b>append-only</b>.
 *
 * <p>Chỉ có getter, không có API sửa/xóa. Mỗi thao tác ghi/cập nhật/sửa sau khóa thành công
 * tạo đúng một dòng, lưu before/after của {@code status}, {@code note} và {@code version} để
 * phục vụ kiểm toán (NFR-AUD).</p>
 */
@Entity
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "attendance_history",
        indexes = {
                @Index(name = "idx_attendance_history_record", columnList = "attendance_id,changed_at"),
                @Index(name = "idx_attendance_history_session", columnList = "session_id,student_id"),
                @Index(name = "idx_attendance_history_correlation", columnList = "correlation_id")
        })
public class AttendanceHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "attendance_id", nullable = false)
    Long attendanceId;

    @Column(name = "session_id", nullable = false)
    Long sessionId;

    @Column(name = "student_id", nullable = false)
    Long studentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 20)
    AttendanceHistoryAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    AttendanceStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 20)
    AttendanceStatus toStatus;

    @Column(name = "from_note", length = 500)
    String fromNote;

    @Column(name = "to_note", length = 500)
    String toNote;

    @Column(name = "version_before")
    Long versionBefore;

    @Column(name = "version_after")
    Long versionAfter;

    /** Lý do (bắt buộc khi là CORRECTION — BR-ATT-03). */
    @Column(name = "reason", length = 500)
    String reason;

    @Column(name = "changed_by", nullable = false)
    Long changedBy;

    @Column(name = "changed_at", nullable = false)
    LocalDateTime changedAt;

    @Column(name = "correlation_id", length = 100)
    String correlationId;

    @Column(name = "idempotency_key", length = 120)
    String idempotencyKey;
}
