package com.example.starter_project_2025.system.notification.policy;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/notifications/policies")
@RequiredArgsConstructor
public class NotificationPolicyController {

    private final TenantNotificationPolicyService policyService;

    @GetMapping
    public List<TenantNotificationPolicyDTO> getPolicies(@AuthenticationPrincipal UserPrincipal principal) {
        UserPrincipal active = requireActivePrincipal(principal);
        return policyService.getPolicies(active.getUser().getTenantId());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('NOTIFICATION_POLICY_MANAGE')")
    public List<TenantNotificationPolicyDTO> updatePolicies(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody List<TenantNotificationPolicyDTO> body
    ) {
        UserPrincipal active = requireActivePrincipal(principal);
        return policyService.updatePolicies(
                active.getUser().getTenantId(),
                active.getUser().getId(),
                active.getUser().getEmail(),
                body
        );
    }

    private UserPrincipal requireActivePrincipal(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null
                || !Boolean.TRUE.equals(principal.getUser().getIsActive())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal;
    }
}
