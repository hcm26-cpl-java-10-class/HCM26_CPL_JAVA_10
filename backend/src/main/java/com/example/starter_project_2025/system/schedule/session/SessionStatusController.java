package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.schedule.session.dto.SessionCancelRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Session Operational Status (v1)",
        description = "Cập nhật trạng thái buổi học — Trainer được phân công / Class Admin")
public class SessionStatusController {

    SessionService sessionService;

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Hủy buổi học (shortcut — cần cancelReason)",
            description = """
                    Chuyển một chiều SCHEDULED -> CANCELLED.
                    - 422 VALIDATION_FAILED: thiếu cancelReason / vượt 500 ký tự
                    - 404 SESSION_NOT_FOUND: không tồn tại
                    - 409 SESSION_VERSION_CONFLICT: If-Match/version không khớp
                    - 409 SESSION_INVALID_TRANSITION: buổi không ở trạng thái SCHEDULED
                    - 401/403: chưa xác thực / thiếu quyền
                    """)
    public ResponseEntity<SessionDTO> cancel(
            @PathVariable Long id,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody(required = false) SessionCancelRequest request
    ) {
        SessionCancelRequest payload = request != null ? request : new SessionCancelRequest();
        Long expectedVersion = resolveExpectedVersion(ifMatch, payload.getVersion());

        SessionDTO response = sessionService.cancel(id, payload, expectedVersion);
        return ResponseEntity.ok()
                .eTag(String.valueOf(response.getVersion()))
                .body(response);
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
