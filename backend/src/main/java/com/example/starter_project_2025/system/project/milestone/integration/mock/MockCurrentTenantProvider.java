package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentTenantProvider;
import com.example.starter_project_2025.system.project.rubric.integration.RubricTenantIdentity;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@Profile("!milestone-real-integrations")
public class MockCurrentTenantProvider implements CurrentTenantProvider {
    @Override
    public UUID requireCurrentTenantId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
            Long tenantId = principal.getUser() != null && principal.getUser().getTenantId() != null
                    ? principal.getUser().getTenantId()
                    : principal.getTenantId();
            if (tenantId == null) throw new AccessDeniedException("A tenant must be assigned to manage rubrics");
            return RubricTenantIdentity.from(tenantId);
        }
        return RubricTenantIdentity.from(MockMilestoneData.TENANT_ID);
    }
}
