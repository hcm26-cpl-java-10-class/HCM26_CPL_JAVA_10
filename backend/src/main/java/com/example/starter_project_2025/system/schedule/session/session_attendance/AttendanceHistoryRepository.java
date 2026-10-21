package com.example.starter_project_2025.system.schedule.session.session_attendance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** T1 — Truy cập lịch sử thay đổi điểm danh (chỉ ghi thêm, chỉ đọc ra). */
public interface AttendanceHistoryRepository extends JpaRepository<AttendanceHistory, Long> {

    List<AttendanceHistory> findByAttendanceIdOrderByChangedAtAscIdAsc(Long attendanceId);

    List<AttendanceHistory> findBySessionIdOrderByChangedAtAscIdAsc(Long sessionId);

    long countByAttendanceId(Long attendanceId);
}
