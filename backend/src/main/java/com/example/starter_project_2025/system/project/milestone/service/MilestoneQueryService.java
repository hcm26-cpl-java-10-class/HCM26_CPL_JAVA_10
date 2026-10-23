package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestonePageResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneDetailResponse;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.port.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MilestoneQueryService {

    private static final int MAX_PAGE_SIZE = 100;

    private final CurrentActorProvider actorProvider;
    private final CurrentTenantProvider tenantProvider;
    private final ProjectMilestonePort projectPort;
    private final MilestoneAccessPolicy accessPolicy;
    private final MilestoneRepository repository;
    private final MilestoneMapper mapper;
    private final MilestoneDetailMapper detailMapper;
    private final RubricCatalogPort rubricPort;
    private final ReviewerDirectoryPort reviewerPort;
    private final TenantSettingsPort tenantSettingsPort;

    @Transactional(readOnly = true)
    public MilestonePageResponse getList(UUID projectId, int page, int size) {
        validatePagination(page, size);
        UUID actorId = actorProvider.requireCurrentActorId();
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        ProjectReadContext project = projectPort.requireProjectForRead(projectId, actorId, tenantId);
        accessPolicy.requireReadAccess(project);

        PageRequest pageable = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.asc("deadline"), Sort.Order.asc("id"))
        );
        return mapper.toPageResponse(
                project,
                repository.findAllByProjectIdAndTenantId(projectId, tenantId, pageable)
        );
    }

    @Transactional(readOnly = true)
    public MilestoneDetailResponse getDetail(UUID projectId, UUID milestoneId) {
        UUID actorId = actorProvider.requireCurrentActorId();
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        ProjectReadContext project = projectPort.requireProjectForRead(projectId, actorId, tenantId);
        accessPolicy.requireReadAccess(project);
        var milestone = repository.findByIdAndProjectIdAndTenantId(milestoneId, projectId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        var rubric = rubricPort.requireSnapshotForRead(milestone.getRubricSnapshotId(), projectId, tenantId);
        var reviewer = reviewerPort.requireReviewerForRead(milestone.getReviewerId(), projectId, tenantId);
        var tenantTimeZone = tenantSettingsPort.requireTimeZone(tenantId);
        return detailMapper.toResponse(milestone, project, rubric, reviewer, tenantTimeZone);
    }

    private void validatePagination(int page, int size) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (page < 0) {
            errors.put("page", List.of("Page must be greater than or equal to 0"));
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            errors.put("size", List.of("Size must be between 1 and 100"));
        }
        if (!errors.isEmpty()) {
            throw new MilestoneValidationException(errors);
        }
    }
}
