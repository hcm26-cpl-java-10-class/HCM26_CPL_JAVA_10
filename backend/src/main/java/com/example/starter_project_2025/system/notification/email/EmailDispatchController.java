package com.example.starter_project_2025.system.notification.email;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.notification.template.EmailTemplateUpsertRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/emails")
@RequiredArgsConstructor
public class EmailDispatchController {

    private final EmailDispatchService dispatchService;

    @PostMapping("/preview")
    @PreAuthorize("hasAuthority('EMAIL_SEND')")
    public EmailTemplateUpsertRequest.PreviewResponse preview(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody EmailSendRequest request
    ) {
        UserPrincipal actor = requireActive(principal);
        return dispatchService.previewCompose(actor.getUser().getTenantId(), request);
    }

    @PostMapping("/send")
    @PreAuthorize("hasAuthority('EMAIL_SEND')")
    public EmailSendRequest.BatchResult send(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody EmailSendRequest request
    ) {
        UserPrincipal actor = requireActive(principal);
        return dispatchService.send(
                actor.getUser().getTenantId(),
                actor.getUser().getId(),
                actor.getUser().getEmail(),
                idempotencyKey,
                request
        );
    }

    private UserPrincipal requireActive(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null
                || !Boolean.TRUE.equals(principal.getUser().getIsActive())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal;
    }
}
