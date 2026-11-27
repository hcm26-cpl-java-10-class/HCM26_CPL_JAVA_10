package com.example.starter_project_2025.system.notification.template;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/email-templates")
@RequiredArgsConstructor
public class EmailTemplateController {

    private final EmailTemplateService templateService;

    @GetMapping
    @PreAuthorize("hasAuthority('EMAIL_TEMPLATE_READ')")
    public Page<EmailTemplateDTO> search(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        UserPrincipal actor = requireActive(principal);
        NotificationCategory parsedCategory = NotificationCategory.parse(category);
        return templateService.search(actor.getUser().getTenantId(), keyword, parsedCategory, active, page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('EMAIL_TEMPLATE_READ')")
    public EmailTemplateDTO getById(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        UserPrincipal actor = requireActive(principal);
        return templateService.getById(actor.getUser().getTenantId(), id);
    }

    @GetMapping("/{id}/versions")
    @PreAuthorize("hasAuthority('EMAIL_TEMPLATE_READ')")
    public List<EmailTemplateVersionDTO> listVersions(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        UserPrincipal actor = requireActive(principal);
        return templateService.listVersions(actor.getUser().getTenantId(), id);
    }

    @PostMapping("/preview")
    @PreAuthorize("hasAuthority('EMAIL_TEMPLATE_READ')")
    public EmailTemplateUpsertRequest.PreviewResponse preview(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody EmailTemplateUpsertRequest.PreviewRequest request
    ) {
        UserPrincipal actor = requireActive(principal);
        return templateService.preview(actor.getUser().getTenantId(), request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('EMAIL_TEMPLATE_MANAGE')")
    public EmailTemplateDTO create(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody EmailTemplateUpsertRequest request
    ) {
        UserPrincipal actor = requireActive(principal);
        return templateService.create(
                actor.getUser().getTenantId(),
                actor.getUser().getId(),
                actor.getUser().getEmail(),
                request
        );
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('EMAIL_TEMPLATE_MANAGE')")
    public EmailTemplateDTO update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestBody EmailTemplateUpsertRequest request
    ) {
        UserPrincipal actor = requireActive(principal);
        return templateService.update(
                actor.getUser().getTenantId(),
                actor.getUser().getId(),
                actor.getUser().getEmail(),
                id,
                request
        );
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('EMAIL_TEMPLATE_MANAGE')")
    public EmailTemplateDTO updateStatus(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestBody EmailTemplateUpsertRequest.StatusRequest request
    ) {
        UserPrincipal actor = requireActive(principal);
        return templateService.updateStatus(
                actor.getUser().getTenantId(),
                actor.getUser().getId(),
                actor.getUser().getEmail(),
                id,
                request != null && request.active()
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
