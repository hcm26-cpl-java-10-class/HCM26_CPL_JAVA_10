package com.example.starter_project_2025.system.audit.guard;

import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/security-alerts")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Security Alerts", description = "Suspicious activity warnings and temporary user blocking")
public class SecurityAlertController {

    private final SecurityAlertService alertService;
    private final UserBlockService blockService;

    @GetMapping
    public ResponseEntity<Page<SecurityAlertDTO>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        if (page < 0 || size < 1 || size > 100) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(alertService.list(status, page, size));
    }

    @GetMapping("/open-count")
    public Map<String, Long> openCount() {
        return Map.of("count", alertService.countOpen());
    }

    @PostMapping("/{id}/dismiss")
    public ResponseEntity<Void> dismiss(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        alertService.dismiss(id, admin.getUser().getId(), admin.getUsername());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/blocked-users")
    public List<BlockedUserDTO> blockedUsers() {
        return blockService.listBlocked();
    }

    @PostMapping("/users/{userId}/block")
    public BlockedUserDTO block(
            @PathVariable Long userId,
            @Valid @RequestBody BlockUserRequest request,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        return blockService.block(
                userId, request.days(), request.reason(),
                admin.getUser().getId(), admin.getUsername());
    }

    @PostMapping("/users/{userId}/extend")
    public BlockedUserDTO extend(
            @PathVariable Long userId,
            @Valid @RequestBody BlockUserRequest request,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        return blockService.extend(
                userId, request.days(), request.reason(),
                admin.getUser().getId(), admin.getUsername());
    }

    @PostMapping("/users/{userId}/unblock")
    public ResponseEntity<Void> unblock(
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        blockService.unblock(userId, admin.getUser().getId(), admin.getUsername());
        return ResponseEntity.noContent().build();
    }
}
