<<<<<<<< HEAD:backend/src/main/java/com/example/starter_project_2025/system/schedule/session_status/SessionStatusController.java
package com.example.starter_project_2025.system.schedule.session_status;
========
package com.example.starter_project_2025.system.schedule.session;
>>>>>>>> bea2080d3d5e575eb31f9e5e7775052426cc9e41:backend/src/main/java/com/example/starter_project_2025/system/schedule/session/SessionStatusController.java

import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.exception.BadRequestException;
<<<<<<<< HEAD:backend/src/main/java/com/example/starter_project_2025/system/schedule/session_status/SessionStatusController.java
import com.example.starter_project_2025.system.schedule.SessionDTO;
import com.example.starter_project_2025.system.schedule.SessionService;
import com.example.starter_project_2025.system.schedule.SessionStatus;
import com.example.starter_project_2025.system.schedule.dto.SessionCancelRequest;
========
import com.example.starter_project_2025.system.schedule.session.dto.SessionCancelRequest;
>>>>>>>> bea2080d3d5e575eb31f9e5e7775052426cc9e41:backend/src/main/java/com/example/starter_project_2025/system/schedule/session/SessionStatusController.java
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

    @PatchMapping("/{id}/status")
    @Operation(summary = "Change the status of session")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SessionDTO> changeSessionStatus(@PathVariable Long id, @RequestParam SessionStatus status) {
        return  ResponseEntity.ok(sessionStatusService.changeStatus(id, status));
    }


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

        SessionDTO response = sessionStatusService.cancel(id, payload, expectedVersion);
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
