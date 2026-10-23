package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneResponse;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentTenantProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MilestoneQueryService {

    private final CurrentActorProvider actorProvider;
    private final CurrentTenantProvider tenantProvider;
    private final ProjectMilestonePort projectPort;
    private final MilestoneAccessPolicy accessPolicy;
    private final MilestoneRepository repository;
    private final MilestoneMapper mapper;

    @Transactional(readOnly = true)
    public MilestoneResponse getDetail(UUID projectId, UUID milestoneId) {
        UUID actorId = actorProvider.requireCurrentActorId();
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        accessPolicy.requireAccess(projectPort.requireProjectForCreation(projectId, actorId, tenantId));
        return repository.findByIdAndProjectIdAndTenantId(milestoneId, projectId, tenantId)
                .map(mapper::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
    }
}
