package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentTenantProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component
@Profile("!milestone-real-integrations")
public class MockCurrentTenantProvider implements CurrentTenantProvider {
    @Override
    public UUID requireCurrentTenantId() {
        return UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    }
}
