package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentTenantProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Component
@Profile("!milestone-real-integrations")
public class MockCurrentTenantProvider implements CurrentTenantProvider {
    @Override
    public UUID requireCurrentTenantId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        Long tenantId = (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserPrincipal principal
                && principal.getTenantId() != null)
                ? principal.getTenantId()
                : MockMilestoneData.TENANT_ID;
        return UUID.nameUUIDFromBytes(("tenant:" + tenantId).getBytes(StandardCharsets.UTF_8));
    }
}
