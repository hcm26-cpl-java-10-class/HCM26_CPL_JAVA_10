package com.example.starter_project_2025.system.schedule.session.session_attendance.dto;

import com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceMembershipStatus;
import com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * T1 — Response của một bản ghi điểm danh.
 *
 * <p>{@code recordedBy/At} và {@code updatedBy/At} là server-set (NFR-AUD); {@code version}
 * dùng cho optimistic locking ↔ {@code ETag}/{@code If-Match}.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AttendanceResponse {

    Long id;

    Long sessionId;

    Long classId;

    Long calendarVersionId;

    Long studentId;

    AttendanceStatus status;

    String note;

    LocalDate attendanceDate;

    /** Snapshot trạng thái thành viên tại thời điểm ghi. */
    AttendanceMembershipStatus membershipStatus;

    Long recordedBy;

    LocalDateTime recordedAt;

    Long updatedBy;

    LocalDateTime updatedAt;

    Long version;

    /** {@code true} khi lớp đã COMPLETED ⇒ bản ghi chỉ đọc, trừ khi có quyền unlock. */
    Boolean locked;

    /** Correlation ID của request (NFR-OBS). */
    String correlationId;

    /** {@code true} khi trả lại kết quả cũ theo {@code Idempotency-Key}. */
    Boolean idempotentReplay;
}
