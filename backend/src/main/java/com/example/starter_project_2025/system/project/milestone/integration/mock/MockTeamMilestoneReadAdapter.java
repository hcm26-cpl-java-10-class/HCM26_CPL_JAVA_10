package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.integration.port.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Keeps the existing isolated milestone fixtures in their explicit test profile. */
@Component @Profile("test & !artifact-real-scope") @RequiredArgsConstructor
public class MockTeamMilestoneReadAdapter implements TeamMilestoneReadPort {
    private final MilestoneTenantProvider tenantProvider;
    public Long requireTenant(Long teamId){return tenantProvider.requireCurrentTenantId();}
}
