package com.example.starter_project_2025.system.project.milestone.integration.model;

import java.util.UUID;

public record ProjectCreationContext(
        UUID projectId,
        UUID tenantId,
        String projectName,
        ProjectStatus status,
        boolean tenantActive,
        boolean mentorAssigned,
        boolean milestoneCreationAllowed
) {
}
