package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceHistoryResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceResponse;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * T1 — Chuyển entity ↔ DTO. Map tường minh (không dùng reflection) để kiểm soát chính xác
 * các trường server-set và snapshot.
 */
@Component
public class AttendanceMapper {

    public AttendanceResponse toResponse(Attendance entity, boolean locked) {
        if (entity == null) {
            return null;
        }
        // Contract chỉ trả updatedBy/updatedAt sau khi bản ghi thực sự được cập nhật (version > 0).
        boolean updated = entity.versionOrZero() > 0;
        return AttendanceResponse.builder()
                .id(entity.getId())
                .sessionId(entity.getSessionId())
                .classId(entity.getClassId())
                .calendarVersionId(entity.getCalendarVersionId())
                .studentId(entity.getStudentId())
                .status(entity.getStatus())
                .note(entity.getNote())
                .attendanceDate(entity.getAttendanceDate())
                .membershipStatus(entity.getMembershipStatus())
                .recordedBy(entity.getRecordedBy())
                .recordedAt(entity.getRecordedAt())
                .updatedBy(updated ? entity.getUpdatedBy() : null)
                .updatedAt(updated ? entity.getUpdatedAt() : null)
                .version(entity.versionOrZero())
                .locked(locked)
                .build();
    }

    public AttendanceHistoryResponse toHistoryResponse(AttendanceHistory history) {
        if (history == null) {
            return null;
        }
        return AttendanceHistoryResponse.builder()
                .id(history.getId())
                .attendanceId(history.getAttendanceId())
                .sessionId(history.getSessionId())
                .studentId(history.getStudentId())
                .action(history.getAction())
                .fromStatus(history.getFromStatus())
                .toStatus(history.getToStatus())
                .fromNote(history.getFromNote())
                .toNote(history.getToNote())
                .versionBefore(history.getVersionBefore())
                .versionAfter(history.getVersionAfter())
                .reason(history.getReason())
                .changedBy(history.getChangedBy())
                .changedAt(history.getChangedAt())
                .correlationId(history.getCorrelationId())
                .build();
    }

    public List<AttendanceHistoryResponse> toHistoryResponses(List<AttendanceHistory> histories) {
        return histories == null ? List.of() : histories.stream().map(this::toHistoryResponse).toList();
    }
}
