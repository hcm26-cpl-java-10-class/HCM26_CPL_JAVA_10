package com.example.starter_project_2025.system.schedule.session.session_attendance;

import java.util.ArrayList;
import java.util.List;

/**
 * T1 — Deterministic demo fixtures shared by the startup seeder
 * ({@link AttendanceDemoDataInitializer}) and the on-demand demo endpoint
 * ({@code POST /api/v1/sessions/{sessionId}/attendance:demo-seed}).
 *
 * <p>Keeping the fixtures in one place guarantees both entry points produce the same
 * cohort (students 2001…2008) and the same status distribution, so the sheet is never
 * half-seeded with a different pattern.</p>
 */
final class AttendanceDemoData {

    static final long FIRST_STUDENT_ID = 2001L;
    static final int STUDENT_COUNT = 8;

    private AttendanceDemoData() {
    }

    static List<Long> studentIds() {
        List<Long> ids = new ArrayList<>(STUDENT_COUNT);
        for (int index = 0; index < STUDENT_COUNT; index++) {
            ids.add(FIRST_STUDENT_ID + index);
        }
        return ids;
    }

    /** 5 PRESENT, 1 LATE, 2 ABSENT per session — enough to exercise every summary counter. */
    static AttendanceStatus statusFor(long studentId) {
        int index = Math.floorMod((int) (studentId - FIRST_STUDENT_ID), STUDENT_COUNT);
        return switch (index) {
            case 2 -> AttendanceStatus.LATE;
            case 3, 7 -> AttendanceStatus.ABSENT;
            case 4 -> AttendanceStatus.EXCUSED;
            default -> AttendanceStatus.PRESENT;
        };
    }

    static String noteFor(AttendanceStatus status) {
        return switch (status) {
            case LATE -> "Arrived 10 minutes late";
            case ABSENT -> "Absent without notice";
            case EXCUSED -> "Excused — sick leave";
            case PRESENT -> null;
        };
    }
}
