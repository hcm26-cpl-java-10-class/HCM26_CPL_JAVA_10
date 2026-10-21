package com.example.starter_project_2025.system.schedule.session.session_attendance.dto;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;

/**
 * T1 — Result of {@code POST /api/v1/sessions/{sessionId}/attendance:demo-seed}.
 *
 * <p>Demo helper: creates attendance for the fixed demo cohort (students 2001…2008) that
 * does not have a record yet. Records go through the normal write path, so history/audit/
 * outbox rows are produced exactly like a real request.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AttendanceDemoSeedResponse {

    Long sessionId;

    Integer created;

    /** Students that already had a record and were left untouched. */
    Integer skipped;

    @Builder.Default
    List<AttendanceResponse> records = new ArrayList<>();

    String correlationId;
}
