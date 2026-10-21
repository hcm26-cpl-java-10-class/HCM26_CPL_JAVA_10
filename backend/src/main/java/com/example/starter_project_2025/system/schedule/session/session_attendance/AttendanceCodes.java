package com.example.starter_project_2025.system.schedule.session.session_attendance;

/**
 * T1 — Mã lỗi API dùng chung giữa service, controller và test (mục 8 của đặc tả).
 */
public final class AttendanceCodes {

    public static final String VALIDATION_FAILED = "VALIDATION_FAILED";
    public static final String BAD_REQUEST = "BAD_REQUEST";
    public static final String UNAUTHENTICATED = "UNAUTHENTICATED";
    public static final String FORBIDDEN = "FORBIDDEN";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    public static final String ATTENDANCE_NOT_FOUND = "ATTENDANCE_NOT_FOUND";
    public static final String SESSION_NOT_FOUND = "SESSION_NOT_FOUND";
    public static final String STUDENT_NOT_FOUND = "STUDENT_NOT_FOUND";

    public static final String SESSION_CANCELLED = "SESSION_CANCELLED";
    public static final String CALENDAR_VERSION_NOT_ACTIVE = "CALENDAR_VERSION_NOT_ACTIVE";
    public static final String CLASS_NOT_ONGOING = "CLASS_NOT_ONGOING";
    public static final String ATTENDANCE_LOCKED = "ATTENDANCE_LOCKED";
    public static final String ATTENDANCE_DUPLICATE = "ATTENDANCE_DUPLICATE";
    public static final String ATTENDANCE_VERSION_CONFLICT = "ATTENDANCE_VERSION_CONFLICT";
    public static final String IDEMPOTENCY_KEY_REUSED = "IDEMPOTENCY_KEY_REUSED";

    public static final String SESSION_DATE_IN_FUTURE = "SESSION_DATE_IN_FUTURE";
    public static final String STUDENT_NOT_IN_CLASS = "STUDENT_NOT_IN_CLASS";
    public static final String STUDENT_NOT_ACTIVE = "STUDENT_NOT_ACTIVE";

    public static final String CONTRACT_UNAVAILABLE = "CONTRACT_UNAVAILABLE";
    public static final String METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED";
    public static final String DEMO_SEED_DISABLED = "DEMO_SEED_DISABLED";

    private AttendanceCodes() {
    }
}
