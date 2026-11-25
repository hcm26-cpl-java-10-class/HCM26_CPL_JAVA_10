package com.example.starter_project_2025.system.notification.email;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/emails/history")
@RequiredArgsConstructor
public class EmailHistoryController {

    private final EmailDispatchService dispatchService;

    @GetMapping
    @PreAuthorize("hasAuthority('EMAIL_LOG_READ')")
    public Page<EmailAttemptDTO> search(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String contextRef,
            @RequestParam(required = false) String recipient,
            @RequestParam(required = false) EmailDeliveryStatus status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        UserPrincipal actor = requireActive(principal);
        return dispatchService.searchHistory(
                actor.getUser().getTenantId(),
                actor.getUser().getId(),
                isAdmin(actor),
                contextRef,
                recipient,
                status,
                NotificationCategory.parse(category),
                fromDate,
                toDate,
                page,
                size
        );
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('EMAIL_LOG_READ')")
    public EmailAttemptDTO getDetail(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        UserPrincipal actor = requireActive(principal);
        return dispatchService.getHistoryDetail(
                actor.getUser().getTenantId(),
                actor.getUser().getId(),
                isAdmin(actor),
                id
        );
    }

    @PostMapping("/{id}/retry")
    @PreAuthorize("hasAuthority('EMAIL_SEND')")
    public EmailAttemptDTO retry(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        UserPrincipal actor = requireActive(principal);
        return dispatchService.retryHistory(
                actor.getUser().getTenantId(),
                actor.getUser().getId(),
                actor.getUser().getEmail(),
                isAdmin(actor),
                id
        );
    }

    private UserPrincipal requireActive(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null
                || !Boolean.TRUE.equals(principal.getUser().getIsActive())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal;
    }

    private boolean isAdmin(UserPrincipal principal) {
        return principal.getUser().getRoles() != null
                && principal.getUser().getRoles().stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r.getName()));
    }
}
