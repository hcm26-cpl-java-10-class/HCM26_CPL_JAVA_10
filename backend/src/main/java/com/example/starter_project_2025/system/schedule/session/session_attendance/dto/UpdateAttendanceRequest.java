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
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * T1 — Body cho {@code PATCH}/{@code PUT} {@code /api/v1/attendance-records/{id}}.
 *
 * <pre>{ "status": "PRESENT", "note": "Đi muộn 10 phút", "reason": null, "version": 2 }</pre>
 *
 * <p>{@code reason} chỉ bắt buộc khi sửa bản ghi đã LOCK (lớp COMPLETED — BR-ATT-03).
 * Các trường hệ thống và {@code sessionId}/{@code studentId} là bất biến: client gửi lên ⇒ 422.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UpdateAttendanceRequest {

    static final Set<String> SYSTEM_FIELDS = Set.of(
            "recordedby", "recordedat", "updatedby", "updatedat",
            "classid", "calendarversionid", "attendancedate", "membershipstatus",
            "sessionid", "studentid");

    /** Trạng thái mới; bắt buộc với PUT, tuỳ chọn với PATCH. */
    String status;

    String note;

    /** Lý do sửa (bắt buộc khi bản ghi đã LOCK). */
    String reason;

    /** Phiên bản client đang giữ — fallback khi không gửi {@code If-Match}. */
    Long version;

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
