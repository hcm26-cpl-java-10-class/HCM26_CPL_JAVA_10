package com.example.starter_project_2025.system.schedule.session.session_attendance;

import java.util.Locale;

/**
 * T1 — Chế độ ghi bảng điểm danh của một session.
 *
 * <ul>
 *     <li>{@link #UPSERT} (mặc định) — tạo nếu chưa có, cập nhật nếu đã có (SCR-53)</li>
 *     <li>{@link #CREATE_ONLY} — chỉ tạo mới; dòng đã tồn tại bị từ chối</li>
 * </ul>
 */
public enum AttendanceBulkMode {
    UPSERT,
    CREATE_ONLY;

    public static AttendanceBulkMode parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return UPSERT;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        for (AttendanceBulkMode mode : values()) {
            if (mode.name().equals(normalized)) {
                return mode;
            }
        }
        return null;
    }

    public static String allowedValues() {
        return "UPSERT, CREATE_ONLY";
    }
}
