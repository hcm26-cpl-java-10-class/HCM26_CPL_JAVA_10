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
 * T1 — Một dòng trong bảng điểm danh gửi lên ({@code POST /api/v1/sessions/{sessionId}/attendance:bulk}).
 *
 * <pre>{ "studentId": 2002, "status": "ABSENT", "note": "Không phép", "version": 2 }</pre>
 *
 * <p>{@code version} là phiên bản client đang giữ; nếu khác bản ghi hiện tại thì dòng đó bị
 * từ chối với {@code ATTENDANCE_VERSION_CONFLICT} (các dòng khác vẫn được xử lý).</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkAttendanceItem {

    static final Set<String> SYSTEM_FIELDS = Set.of(
            "recordedby", "recordedat", "updatedby", "updatedat",
            "classid", "calendarversionid", "attendancedate", "membershipstatus",
            "sessionid", "id", "attendanceid");

    Long studentId;

    String status;

    String note;

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
