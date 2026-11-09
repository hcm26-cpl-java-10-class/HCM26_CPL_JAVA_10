package com.example.starter_project_2025.system.project.milestone.integration.model;

import java.util.UUID;

public record ReviewerData(
        UUID id,
        String displayName,
        boolean active,
        boolean assignedToProject
) {
}
