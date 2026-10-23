package com.example.starter_project_2025.system.project.milestone.integration.port;

import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;

import java.util.UUID;

public interface ProjectMilestonePort {
    ProjectCreationContext requireProjectForCreation(UUID projectId, UUID actorId, UUID tenantId);
}
