package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus;

import java.util.UUID;

public record MilestoneDetailProjectResponse(
        UUID id,
        String name,
        ProjectStatus status
) {
}
