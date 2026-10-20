package com.example.starter_project_2025.system.schedule.session_audit.dto;

import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * T2 — Một dòng lịch sử chuyển trạng thái ({@code GET /api/v1/sessions/{id}/history}).
 *
 * <pre>{ "id": 501, "sessionId": 1001, "fromStatus": "SCHEDULED", "toStatus": "COMPLETED",
 * "reason": null, "changedBy": 77, "changedAt": "2026-10-20T11:05:12", "correlationId": "..." }</pre>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionStatusHistoryResponse {

    Long id;

    Long sessionId;

    SessionStatus fromStatus;

    SessionStatus toStatus;

    String reason;

    Long changedBy;

    LocalDateTime changedAt;

    String correlationId;
}
