package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestonePageResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneDetailResponse;
import com.example.starter_project_2025.system.project.milestone.dto.request.MilestoneListQuery;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.port.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MilestoneQueryService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_SEARCH_LENGTH = 120;

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
    public MilestonePageResponse getList(UUID projectId, MilestoneListQuery query) {
        String search = normalizeSearch(query.search());
        validateListQuery(query, search);
        UUID actorId = actorProvider.requireCurrentActorId();
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        ProjectReadContext project = projectPort.requireProjectForRead(projectId, actorId, tenantId);
        accessPolicy.requireReadAccess(project);

        Instant deadlineFrom = null;
        Instant deadlineToExclusive = null;
        if (query.deadlineFrom() != null || query.deadlineTo() != null) {
            ZoneId tenantTimeZone = tenantSettingsPort.requireTimeZone(tenantId);
            if (query.deadlineFrom() != null) {
                deadlineFrom = query.deadlineFrom().atStartOfDay(tenantTimeZone).toInstant();
            }
            if (query.deadlineTo() != null) {
                deadlineToExclusive = query.deadlineTo().plusDays(1).atStartOfDay(tenantTimeZone).toInstant();
            }
        }

        PageRequest pageable = PageRequest.of(
                query.page(),
                query.size(),
                Sort.by(Sort.Order.asc("deadline"), Sort.Order.asc("id"))
        );
        return mapper.toPageResponse(
                project,
                repository.findAll(
                        MilestoneSpecifications.matching(
                                tenantId,
                                projectId,
                                search,
                                query.status(),
                                query.mandatory(),
                                query.latePolicyType(),
                                deadlineFrom,
                                deadlineToExclusive
                        ),
                        pageable
                )
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
        var reviewer = milestone.getReviewerId() == null
                ? null
                : reviewerPort.requireReviewerForRead(milestone.getReviewerId(), projectId, tenantId);
        var tenantTimeZone = tenantSettingsPort.requireTimeZone(tenantId);
        return detailMapper.toResponse(milestone, project, rubric, reviewer, tenantTimeZone);
    }

    private void validateListQuery(MilestoneListQuery query, String search) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (query.page() < 0) {
            errors.put("page", List.of("Page must be greater than or equal to 0"));
        }
        if (query.size() < 1 || query.size() > MAX_PAGE_SIZE) {
            errors.put("size", List.of("Size must be between 1 and 100"));
        }
        if (search != null && search.length() > MAX_SEARCH_LENGTH) {
            errors.put("search", List.of("Search must not exceed 120 characters"));
        }
        if (query.deadlineFrom() != null && query.deadlineTo() != null
                && query.deadlineFrom().isAfter(query.deadlineTo())) {
            errors.put("deadlineFrom", List.of("Deadline from must be before or equal to deadline to"));
        }
        if (!errors.isEmpty()) {
            throw new MilestoneValidationException(errors);
        }
    }

    private String normalizeSearch(String search) {
        if (search == null) {
            return null;
        }
        String normalized = search.trim().replaceAll("\\s+", " ");
        return normalized.isEmpty() ? null : normalized;
    }
}
