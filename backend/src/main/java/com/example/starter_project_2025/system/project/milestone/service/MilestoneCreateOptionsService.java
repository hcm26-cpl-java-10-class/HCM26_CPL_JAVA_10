package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.dto.response.*;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;
import com.example.starter_project_2025.system.project.milestone.integration.port.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MilestoneCreateOptionsService {

    private final CurrentActorProvider actorProvider;
    private final CurrentTenantProvider tenantProvider;
    private final ProjectMilestonePort projectPort;
    private final RubricCatalogPort rubricPort;
    private final ReviewerDirectoryPort reviewerPort;
    private final MilestoneAccessPolicy accessPolicy;

    public MilestoneCreateOptionsResponse getOptions(UUID projectId) {
        UUID actorId = actorProvider.requireCurrentActorId();
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        ProjectCreationContext project = projectPort.requireProjectForCreation(projectId, actorId, tenantId);
        accessPolicy.requireAccess(project);
        accessPolicy.requireCreatableState(project);

        return new MilestoneCreateOptionsResponse(
                new ProjectOptionResponse(project.projectId(), project.projectName(), project.status().name()),
                rubricPort.findAllowedRubrics(projectId, actorId, tenantId).stream()
                        .map(r -> new RubricOptionResponse(r.id(), r.name(), r.version())).toList(),
                reviewerPort.findEligibleReviewers(projectId, actorId, tenantId).stream()
                        .map(r -> new ReviewerOptionResponse(r.id(), r.displayName())).toList()
        );
    }
}
