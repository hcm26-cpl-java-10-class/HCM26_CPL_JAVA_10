package com.example.starter_project_2025.system.schedule.session.session_attendance.dto;

import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * T1 / SCR-53 — Bảng điểm danh của một session (dữ liệu cho màn hình dạng sheet).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AttendanceSheetResponse {

    Long sessionId;

    Long classId;

    Long calendarVersionId;

    LocalDate attendanceDate;

    SessionStatus sessionStatus;

    /** {@code true} khi lớp COMPLETED ⇒ bảng ở trạng thái LOCKED (chỉ đọc). */
    Boolean locked;

    Integer total;

    Integer present;

    Integer absent;

    Integer late;

    Integer excused;

    @Builder.Default
    List<AttendanceResponse> records = new ArrayList<>();

    String correlationId;
}
