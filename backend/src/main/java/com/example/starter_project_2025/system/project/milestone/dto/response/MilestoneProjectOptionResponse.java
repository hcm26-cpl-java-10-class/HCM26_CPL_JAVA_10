package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus;

public record MilestoneProjectOptionResponse(
        Long id,
        String code,
        String name,
        ProjectStatus status,
        Long teamId,
        boolean canCreate
) {
    public MilestoneProjectOptionResponse(Long id, String code, String name, ProjectStatus status) {
        this(id, code, name, status, null, false);
    }
}

