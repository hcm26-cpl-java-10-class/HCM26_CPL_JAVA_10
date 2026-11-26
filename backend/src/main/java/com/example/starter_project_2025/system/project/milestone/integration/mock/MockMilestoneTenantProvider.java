package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@Profile("!milestone-mock")
public class MockMilestoneTenantProvider implements MilestoneTenantProvider {
    @Override
    public Long requireCurrentTenantId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Authenticated tenant is required");
        }
        if (authentication.getPrincipal() instanceof UserPrincipal principal) {
            Long tenantId = principal.getUser() != null && principal.getUser().getTenantId() != null
                    ? principal.getUser().getTenantId()
                    : principal.getTenantId();
            if (tenantId == null) throw new AccessDeniedException("A tenant must be assigned to manage milestones");
            return tenantId;
        }
        return MockMilestoneData.TENANT_ID;
    }
}
