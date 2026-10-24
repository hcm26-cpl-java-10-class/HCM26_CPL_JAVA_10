package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.dto.response.*;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;
import com.example.starter_project_2025.system.project.milestone.integration.port.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MilestoneCreateOptionsService {

    private final CurrentActorProvider actorProvider;
    private final CurrentTenantProvider tenantProvider;
    private final ProjectMilestonePort projectPort;
    private final RubricCatalogPort rubricPort;
    private final MilestoneAccessPolicy accessPolicy;

    @Transactional(readOnly = true)
    public MilestoneCreateOptionsResponse getOptions(UUID projectId) {
        UUID actorId = actorProvider.requireCurrentActorId();
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        ProjectCreationContext project = projectPort.requireProjectForCreation(projectId, actorId, tenantId);
        accessPolicy.requireAccess(project);
        accessPolicy.requireCreatableState(project);

        return new MilestoneCreateOptionsResponse(
                new ProjectOptionResponse(project.projectId(), project.projectName(), project.status().name()),
                rubricPort.findAllowedRubrics(projectId, actorId, tenantId).stream()
                        .map(r -> new RubricOptionResponse(
                                r.id(),
                                r.name(),
                                r.version(),
                                        r.criteria().stream()
                                        .map(c -> new RubricCriterionOptionResponse(
                                                c.code(), c.name(), c.weight(), c.maxScore(),
                                                c.ratings().stream().map(rating -> new RubricRatingOptionResponse(
                                                        rating.level(), rating.percentage(), rating.description(), rating.orderIndex())).toList()))
                        .toList()))
                        .toList()
        );
    }
}
