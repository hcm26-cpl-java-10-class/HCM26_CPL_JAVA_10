package com.example.starter_project_2025.system.schedule.session.session_attendance.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * T1 — Body cho {@code POST /api/v1/sessions/{sessionId}/attendance:bulk} (SCR-53).
 *
 * <pre>{
 *   "mode": "UPSERT",
 *   "reason": null,
 *   "items": [ { "studentId": 2001, "status": "PRESENT", "note": null, "version": null } ]
 * }</pre>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkAttendanceRequest {

    static final Set<String> SYSTEM_FIELDS = Set.of(
            "recordedby", "recordedat", "updatedby", "updatedat",
            "classid", "calendarversionid", "attendancedate", "membershipstatus");

    /** UPSERT (mặc định) | CREATE_ONLY. */
    String mode;

    /** Lý do — bắt buộc khi sửa bảng điểm danh của lớp đã COMPLETED (BR-ATT-03). */
    String reason;

    @Builder.Default
    List<BulkAttendanceItem> items = new ArrayList<>();

    @JsonIgnore
    final Map<String, Object> clientSuppliedSystemFields = new LinkedHashMap<>();

    @JsonAnySetter
    public void captureUnknownField(String name, Object value) {
        if (name == null) {
            return;
        }
        String normalized = name.trim();
        if (SYSTEM_FIELDS.contains(normalized.toLowerCase(Locale.ROOT))) {
            clientSuppliedSystemFields.put(normalized, value);
        }
    }
}
