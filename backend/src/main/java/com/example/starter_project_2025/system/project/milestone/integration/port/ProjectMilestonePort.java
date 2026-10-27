package com.example.starter_project_2025.system.project.milestone.integration.port;

import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;

import java.util.UUID;

public interface ProjectMilestonePort {
    ProjectCreationContext requireProjectForCreation(Long projectId, UUID actorId, Long tenantId);

    ProjectReadContext requireProjectForRead(Long projectId, UUID actorId, Long tenantId);
}
