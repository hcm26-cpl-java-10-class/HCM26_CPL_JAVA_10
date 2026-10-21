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
 * T1 / AC T1-05 — Response của {@code POST /api/v1/sessions/{sessionId}/attendance:bulk}.
 *
 * <pre>{ "sessionId": 1001, "total": 30, "created": 24, "updated": 3, "unchanged": 0,
 *         "rejected": 3, "results": [ ... ] }</pre>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkAttendanceResponse {

    Long sessionId;

    Integer total;

    Integer created;

    Integer updated;

    /** Số dòng không thay đổi (gửi lại đúng dữ liệu cũ) — không sinh history/outbox. */
    Integer unchanged;

    Integer rejected;

    @Builder.Default
    List<BulkAttendanceItemResult> results = new ArrayList<>();

    String correlationId;

    Boolean idempotentReplay;
}
