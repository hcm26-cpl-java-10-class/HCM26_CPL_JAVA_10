package com.example.starter_project_2025.system.schedule.session.session_attendance.dto;

import com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceHistoryAction;
import com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/** T1 / BR-ATT-04 — Một dòng lịch sử thay đổi điểm danh (chỉ đọc). */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AttendanceHistoryResponse {

    Long id;

    Long attendanceId;

    Long sessionId;

    Long studentId;

    AttendanceHistoryAction action;

    AttendanceStatus fromStatus;

    AttendanceStatus toStatus;

    String fromNote;

    String toNote;

    Long versionBefore;

    Long versionAfter;

    String reason;

    Long changedBy;

    LocalDateTime changedAt;

    String correlationId;
}
