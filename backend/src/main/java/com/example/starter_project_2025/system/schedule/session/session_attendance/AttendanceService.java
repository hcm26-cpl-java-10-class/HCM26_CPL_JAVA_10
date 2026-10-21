package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceHistoryResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceDemoSeedResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceSheetResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.CreateAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.UpdateAttendanceRequest;

import java.util.List;

/**
 * T1 / US-DEV6-01 — Ghi nhận và cập nhật điểm danh theo Session.
 */
public interface AttendanceService {

    /** Ghi một bản ghi điểm danh (idempotent theo {@code Idempotency-Key}). */
    AttendanceResponse create(CreateAttendanceRequest request, String idempotencyKey);

    /**
     * Cập nhật bản ghi điểm danh.
     *
     * @param fullReplace {@code true} cho PUT (bắt buộc {@code status}), {@code false} cho PATCH
     */
    AttendanceResponse update(Long id,
                              UpdateAttendanceRequest request,
                              Long expectedVersion,
                              String idempotencyKey,
                              boolean fullReplace);

    /** Ghi/cập nhật cả bảng điểm danh của một session (SCR-53). */
    BulkAttendanceResponse bulk(Long sessionId, BulkAttendanceRequest request, String idempotencyKey);

    /**
     * Demo helper — create attendance for the fixed demo cohort (students 2001…2008) that
     * has no record yet in this session. Goes through the normal write path (history, audit,
     * outbox) and is idempotent per student.
     */
    AttendanceDemoSeedResponse seedDemoAttendance(Long sessionId);

    /** Đọc một bản ghi (kèm quyền đọc của trainee đối với bản ghi của chính mình). */
    AttendanceResponse get(Long id);

    /** Bảng điểm danh của session (SCR-53: loading/empty/error/permission denied/conflict). */
    AttendanceSheetResponse getSessionSheet(Long sessionId);

    /** Lịch sử thay đổi (append-only) của một bản ghi. */
    List<AttendanceHistoryResponse> getHistory(Long id);
}
