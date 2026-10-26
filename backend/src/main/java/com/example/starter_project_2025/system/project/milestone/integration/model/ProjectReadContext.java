package com.example.starter_project_2025.system.project.milestone.integration.model;

import java.util.UUID;

public record ProjectReadContext(
        Long projectId,
        Long tenantId,
        String projectName,
        ProjectStatus status,
        boolean tenantActive,
        boolean mentorAssigned
) {
}
