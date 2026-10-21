package com.example.starter_project_2025.system.schedule.session.session_attendance;

import java.util.Locale;

/**
 * T1 — Trạng thái điểm danh của một học viên trong một buổi học (SRS Mục 7).
 *
 * <ul>
 *     <li>{@link #PRESENT} — có mặt</li>
 *     <li>{@link #ABSENT} — vắng không phép</li>
 *     <li>{@link #LATE} — đi muộn</li>
 *     <li>{@link #EXCUSED} — vắng có phép</li>
 * </ul>
 */
public enum AttendanceStatus {
    PRESENT,
    ABSENT,
    LATE,
    EXCUSED;

    /** BR-ATT-02 — vắng/vắng có phép là các trạng thái cần lý do khi policy bật OD-ATT-09. */
    public boolean isAbsence() {
        return this == ABSENT || this == EXCUSED;
    }

    /**
     * @return enum tương ứng hoặc {@code null} nếu giá trị không thuộc enum.
     */
    public static AttendanceStatus parse(String raw) {
        if (raw == null) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return null;
        }
        for (AttendanceStatus status : values()) {
            if (status.name().equals(normalized)) {
                return status;
            }
        }
        return null;
    }

    public static String allowedValues() {
        StringBuilder builder = new StringBuilder();
        for (AttendanceStatus status : values()) {
            if (builder.length() > 0) {
                builder.append(", ");
            }
            builder.append(status.name());
        }
        return builder.toString();
    }
}
