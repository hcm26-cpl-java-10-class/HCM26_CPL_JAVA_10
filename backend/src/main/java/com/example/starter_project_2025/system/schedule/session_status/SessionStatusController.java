package com.example.starter_project_2025.system.schedule.session_status;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.schedule.session.dto.SessionCancelRequest;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.system.schedule.session_status.dto.SessionCompleteRequest;
import com.example.starter_project_2025.system.schedule.session_status.dto.SessionStatusUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Session Operational Status (v1)",
        description = "Cập nhật trạng thái buổi học — Trainer được phân công / Class Admin")
public class SessionStatusController {

    SessionStatusService sessionStatusService;

    /**
     * {@code GET /api/v1/sessions/{id}} — đọc lại trạng thái sau thao tác.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SESSION_READ')")
    @Operation(summary = "Đọc lại trạng thái buổi học")
    public ResponseEntity<SessionDTO> getStatus(@PathVariable Long id) {
        return respond(sessionStatusService.getStatus(id));
    }

    /**
     * {@code PATCH /api/v1/sessions/{id}/status} — endpoint chính.
     *
     * <pre>{ "status": "COMPLETED", "notes": "...", "cancelReason": null, "version": 3 }</pre>
     *
     * <p>Vẫn nhận {@code ?status=...} để tương thích client cũ.</p>
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('SESSION_UPDATE')")
    @Operation(
            summary = "Đổi trạng thái buổi học (endpoint chính)",
            description = """
                    Chỉ cho phép SCHEDULED -> COMPLETED | CANCELLED.
                    - 422 VALIDATION_FAILED: status không hợp lệ / thiếu cancelReason / vượt 500 ký tự
                    - 404 SESSION_NOT_FOUND: không tồn tại
                    - 409 SESSION_VERSION_CONFLICT: If-Match/version không khớp
                    - 409 SESSION_INVALID_TRANSITION: buổi không ở trạng thái SCHEDULED / chưa tới startTime
                    - 409 CALENDAR_VERSION_NOT_ACTIVE: Calendar Version chưa ACTIVE
                    - 409 CLASS_NOT_ONGOING: lớp không ở trạng thái ONGOING
                    - 401/403: chưa xác thực / ngoài phạm vi được phân công
                    """)
    public ResponseEntity<SessionDTO> changeSessionStatus(
            @PathVariable Long id,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody(required = false) SessionStatusUpdateRequest body,
            @RequestParam(required = false) SessionStatus status
    ) {
        SessionStatusUpdateRequest payload = body != null ? body : new SessionStatusUpdateRequest();
        if (payload.getStatus() == null) {
            payload.setStatus(status);
        }
        Long expectedVersion = resolveExpectedVersion(ifMatch, payload.getVersion());
        return respond(sessionStatusService.changeStatus(id, payload, expectedVersion));
    }

    /**
     * {@code POST /api/v1/sessions/{id}/complete} — shortcut hoàn thành.
     */
    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('SESSION_UPDATE')")
    @Operation(
            summary = "Shortcut hoàn thành buổi học",
            description = """
                    Chuyển một chiều SCHEDULED -> COMPLETED.
                    Yêu cầu: Calendar Version ACTIVE, lớp ONGOING, startTime <= now.
                    - 404 SESSION_NOT_FOUND
                    - 409 SESSION_VERSION_CONFLICT / SESSION_INVALID_TRANSITION
                    - 409 CALENDAR_VERSION_NOT_ACTIVE / CLASS_NOT_ONGOING
                    - 401/403: chưa xác thực / ngoài phạm vi được phân công
                    """)
    public ResponseEntity<SessionDTO> complete(
            @PathVariable Long id,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody(required = false) SessionCompleteRequest request
    ) {
        SessionCompleteRequest payload = request != null ? request : new SessionCompleteRequest();
        Long expectedVersion = resolveExpectedVersion(ifMatch, payload.getVersion());
        return respond(sessionStatusService.complete(id, payload, expectedVersion));
    }

    /**
     * {@code POST /api/v1/sessions/{id}/cancel} — shortcut hủy (bắt buộc lý do).
     */
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('SESSION_UPDATE')")
    @Operation(
            summary = "Hủy buổi học (shortcut — cần cancelReason)",
            description = """
                    Chuyển một chiều SCHEDULED -> CANCELLED.
                    Chỉ Class Admin (ROLE_ADMIN) được hủy.
                    - 422 VALIDATION_FAILED: thiếu cancelReason / vượt 500 ký tự
                    - 404 SESSION_NOT_FOUND: không tồn tại
                    - 409 SESSION_VERSION_CONFLICT: If-Match/version không khớp
                    - 409 SESSION_INVALID_TRANSITION: buổi không ở trạng thái SCHEDULED
                    - 409 CALENDAR_VERSION_NOT_ACTIVE: Calendar Version chưa ACTIVE
                    - 401/403: chưa xác thực / không phải Class Admin
                    """)
    public ResponseEntity<SessionDTO> cancel(
            @PathVariable Long id,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody(required = false) SessionCancelRequest request
    ) {
        SessionCancelRequest payload = request != null ? request : new SessionCancelRequest();
        Long expectedVersion = resolveExpectedVersion(ifMatch, payload.getVersion());
        return respond(sessionStatusService.cancel(id, payload, expectedVersion));
    }

    /**
     * Trả body kèm {@code ETag} = version để client gửi lại qua {@code If-Match}.
     */
    private ResponseEntity<SessionDTO> respond(SessionDTO response) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
        if (response.getVersion() != null) {
            builder = builder.eTag(String.valueOf(response.getVersion()));
        }
        return builder.body(response);
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
                throw new BadRequestException("If-Match header không hợp lệ (ETag/version): " + ifMatch);
            }
        }
        return bodyVersion;
    }
}
