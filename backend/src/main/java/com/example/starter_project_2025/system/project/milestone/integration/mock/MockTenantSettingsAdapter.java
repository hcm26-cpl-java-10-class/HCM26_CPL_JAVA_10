package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.integration.port.TenantSettingsPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.util.UUID;

@Component
@Profile("!milestone-mock")
public class MockTenantSettingsAdapter implements TenantSettingsPort {

    private final ZoneId timeZone;

    public MockTenantSettingsAdapter(
            @Value("${milestone.mock.tenant-time-zone:Asia/Ho_Chi_Minh}") String timeZone
    ) {
        this.timeZone = ZoneId.of(timeZone);
    }

    @Override
    public ZoneId requireTimeZone(Long tenantId) {
        return timeZone;
    }
}
