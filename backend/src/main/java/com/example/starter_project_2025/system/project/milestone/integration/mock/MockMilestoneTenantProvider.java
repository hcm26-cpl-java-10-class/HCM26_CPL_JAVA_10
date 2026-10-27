package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.security.UserPrincipal;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@Profile("!milestone-real-integrations")
public class MockMilestoneTenantProvider implements MilestoneTenantProvider {
    @Override
    public Long requireCurrentTenantId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
            Long tenantId = principal.getUser() == null ? null : principal.getUser().getTenantId();
            if (tenantId == null) throw new AccessDeniedException("A tenant must be assigned to manage milestones");
            return tenantId;
        }
        return MockMilestoneData.TENANT_ID;
    }
}
