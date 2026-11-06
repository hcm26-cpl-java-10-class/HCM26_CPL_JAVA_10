package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus;

public record ProjectMilestoneSummaryResponse(
        Long id,
        String name,
        ProjectStatus status
) {
}
