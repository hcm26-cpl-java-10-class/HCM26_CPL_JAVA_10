package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;

@Component
@Profile("!milestone-mock")
public class MockMilestoneTenantProvider implements MilestoneTenantProvider {
    @Override
    public Long requireCurrentTenantId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)
                || principal.getTenantId() == null) {
            throw new AccessDeniedException("Authenticated tenant is required");
        }
        return principal.getTenantId();
    }
}
