package com.example.starter_project_2025.system.schedule.session.session_attendance.dto;

import com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceRecordResult;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * T1 / AC T1-05 — Kết quả xử lý của một dòng trong bulk request.
 *
 * <p>Dòng bị từ chối vẫn có {@code code}/{@code message} và (nếu là xung đột phiên bản)
 * {@code currentVersion} để FE hiển thị reload/merge (SCR-53).</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkAttendanceItemResult {

    Long studentId;

    AttendanceRecordResult result;

    Long id;

    Long version;

    String code;

    String message;

    Long currentVersion;
}
