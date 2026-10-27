package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!milestone-real-integrations")
public class MockMilestoneTenantProvider implements MilestoneTenantProvider {
    @Override
    public Long requireCurrentTenantId() {
        return MockMilestoneData.TENANT_ID;
    }
}
