package com.example.starter_project_2025.system.project.milestone.integration.port;

import java.time.ZoneId;
import java.util.UUID;

public interface TenantSettingsPort {
    ZoneId requireTimeZone(UUID tenantId);
}
