package com.example.starter_project_2025.system.schedule.session_audit;

import com.example.starter_project_2025.system.schedule.session_audit.dto.SessionNotesUpdateResponse;
import com.example.starter_project_2025.system.schedule.session_audit.dto.SessionStatusHistoryResponse;
import com.example.starter_project_2025.system.schedule.session_audit.dto.UpdateSessionNotesRequest;
import com.example.starter_project_2025.system.schedule.session_audit.exception.SessionAuditValidationException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * T2 / US-F15-02 — Cập nhật notes và audit thông tin người cập nhật/thời điểm.
 *
 * <ul>
 *     <li>{@code PATCH /api/v1/sessions/{id}/notes} — ghi notes (kèm transition nếu có {@code status}).</li>
 *     <li>{@code GET /api/v1/sessions/{id}/history} — lịch sử chuyển trạng thái (chỉ đọc).</li>
 * </ul>
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Session Notes & Audit (T2)",
        description = "Ghi notes khi chuyển trạng thái; hệ thống tự ghi người/thời điểm và lịch sử bất biến")
public class SessionAuditController {

    SessionAuditService sessionAuditService;

    /**
     * { "status": "COMPLETED", "notes": "Đã dạy bù phần OOP", "version": 3 }
     */
    @PatchMapping("/{id}/notes")
    @PreAuthorize("hasAuthority('SESSION_UPDATE')")
    @Operation(
            summary = "Cập nhật notes (kèm chuyển trạng thái nếu có status)",
            description = """
                    Ghi notes và/hoặc chuyển trạng thái buổi học; server tự set updatedBy/updatedAt
                    và tạo 1 dòng session_status_history + 1 dòng audit log.
                    - 422 VALIDATION_FAILED: notes > 2000 ký tự; client gửi updatedBy/updatedAt; thiếu lý do hủy
                    - 404 SESSION_NOT_FOUND: không tồn tại
                    - 409 SESSION_VERSION_CONFLICT: If-Match/version không khớp
                    - 409 SESSION_INVALID_TRANSITION: buổi không ở SCHEDULED / chưa tới startTime
                    - 409 CALENDAR_VERSION_NOT_ACTIVE: Calendar Version chưa ACTIVE
                    - 409 IDEMPOTENCY_KEY_REUSED: cùng Idempotency-Key nhưng payload khác
                    - 403 FORBIDDEN: Trainee / ngoài phạm vi được phân công
                    """)
    public ResponseEntity<SessionNotesUpdateResponse> updateNotes(
            @PathVariable Long id,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody(required = false) UpdateSessionNotesRequest body
    ) {
        UpdateSessionNotesRequest payload = body != null ? body : new UpdateSessionNotesRequest();
        Long expectedVersion = resolveExpectedVersion(ifMatch, payload.getVersion());
        SessionNotesUpdateResponse response =
                sessionAuditService.updateNotes(id, payload, expectedVersion, idempotencyKey);

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
        if (response.getVersion() != null) {
            builder = builder.eTag(String.valueOf(response.getVersion()));
        }
        return builder.body(response);
    }

    /**
     * Lịch sử trạng thái (chỉ đọc). Không có endpoint POST/PUT/PATCH/DELETE → 405 (AC T2-03).
     */
    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority('SESSION_READ')")
    @Operation(
            summary = "Lịch sử chuyển trạng thái của buổi học (read-only)",
            description = """
                    Trả danh sách bản ghi bất biến (fromStatus, toStatus, reason, changedBy, changedAt,
                    correlationId).
                    - 404 SESSION_NOT_FOUND
                    - 403 FORBIDDEN: Trainee (không được xem history nội bộ)
                    """)
    public ResponseEntity<List<SessionStatusHistoryResponse>> getHistory(@PathVariable Long id) {
        return ResponseEntity.ok(sessionAuditService.getHistory(id));
    }

    private Long resolveExpectedVersion(String ifMatch, Long bodyVersion) {
        if (ifMatch != null && !ifMatch.isBlank()) {
            String normalized = ifMatch.trim();
            if (normalized.startsWith("W/")) {
                normalized = normalized.substring(2);
            }
            normalized = normalized.replace("\"", "").trim();
            try {
                return Long.parseLong(normalized);
            } catch (NumberFormatException ex) {
                throw SessionAuditValidationException.of(
                        "If-Match", "If-Match header không hợp lệ (ETag/version): " + ifMatch);
            }
        }
        return bodyVersion;
    }
}
