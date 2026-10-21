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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * T1 — Body cho {@code POST /api/v1/attendance-records}.
 *
 * <pre>{ "sessionId": 1001, "studentId": 2001, "status": "PRESENT", "note": null }</pre>
 *
 * <p>Các trường hệ thống ({@code recordedBy/At}, {@code updatedBy/At}, {@code classId},
 * {@code calendarVersionId}, {@code attendanceDate}, {@code membershipStatus}, {@code version})
 * do server sinh: nếu client gửi lên ⇒ 422 {@code VALIDATION_FAILED} (strict DTO).</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CreateAttendanceRequest {

    static final Set<String> SYSTEM_FIELDS = Set.of(
            "recordedby", "recordedat", "updatedby", "updatedat",
            "classid", "calendarversionid", "attendancedate", "membershipstatus", "version");

    Long sessionId;

    Long studentId;

    /** Nhận dạng chuỗi để trả 422 VALIDATION_FAILED (thay vì 400 khi Jackson parse enum). */
    String status;

    /** Ghi chú vận hành, tối đa 500 ký tự. */
    String note;

    @JsonIgnore
    final Map<String, Object> clientSuppliedSystemFields = new LinkedHashMap<>();

    @JsonAnySetter
    public void captureUnknownField(String name, Object value) {
        if (name == null) {
            return;
        }
        String normalized = name.trim();
        if (SYSTEM_FIELDS.contains(normalized.toLowerCase(java.util.Locale.ROOT))) {
            clientSuppliedSystemFields.put(normalized, value);
        }
    }
}
