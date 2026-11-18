package com.example.starter_project_2025.system.project.rubric.integration;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

public final class RubricTenantIdentity {
    private RubricTenantIdentity() {
    }

    public static UUID from(Long tenantId) {
        if (tenantId == null || tenantId <= 0) throw new IllegalArgumentException("A tenant is required");
        return tenantId == 1L ? UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
                : UUID.nameUUIDFromBytes(("milestone:tenant:" + tenantId).getBytes(StandardCharsets.UTF_8));
    }
}
