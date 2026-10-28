package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestonePageResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneProjectOptionResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneDetailResponse;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.dto.request.MilestoneListQuery;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.port.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MilestoneQueryService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_SEARCH_LENGTH = 120;
    private static final Map<String, String> SORT_FIELDS = Map.of(
            "title", "title",
            "description", "description",
            "status", "status",
            "mandatory", "mandatory",
            "deadline", "deadline",
            "latePolicyType", "latePolicyType",
            "createdAt", "createdAt"
    );

    private final CurrentActorProvider actorProvider;
    private final MilestoneTenantProvider tenantProvider;
    private final ProjectMilestonePort projectPort;
    private final MilestoneAccessPolicy accessPolicy;
    private final MilestoneRepository repository;
    private final MilestoneMapper mapper;
    private final MilestoneDetailMapper detailMapper;
    private final RubricCatalogPort rubricPort;
    private final ReviewerDirectoryPort reviewerPort;
    private final TenantSettingsPort tenantSettingsPort;
    private final TeamMilestoneReadPort teamRead;
    private final WorkspaceMilestoneScopeService scopeService;

    @Transactional(readOnly = true)
    public List<MilestoneProjectOptionResponse> getProjectOptions() {
        UUID actorId = actorProvider.requireCurrentActorId();
        Long tenantId = tenantProvider.requireCurrentTenantId();
        return projectPort.listAccessibleProjects(actorId, tenantId);
    }

    @Transactional(readOnly = true)
    public MilestonePageResponse getList(Long projectId, MilestoneListQuery query) {
        String search = normalizeSearch(query.search());
        validateListQuery(query, search);
        UUID actorId = actorProvider.requireCurrentActorId();
        Long tenantId = tenantProvider.requireCurrentTenantId();
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
                buildSort(query.sort())
        );
        return mapper.toPageResponse(
                project,
                repository.findAll(
                        MilestoneSpecifications.matching(
                                tenantId,
                                projectId,
                                query.teamId(),
                                search,
                                query.status(),
                                query.mandatory(),
                                query.latePolicyType(),
                                deadlineFrom,
                                deadlineToExclusive
                        ).and(studentVisibility()),
                        pageable
                )
        );
    }

    @Transactional(readOnly = true)
    public MilestonePageResponse getAllList(MilestoneListQuery query) {
        String search = normalizeSearch(query.search());
        validateListQuery(query, search);
        UUID actorId = actorProvider.requireCurrentActorId();
        Long tenantId = tenantProvider.requireCurrentTenantId();
        Map<Long, String> projectNames = projectPort.listAccessibleProjects(actorId, tenantId).stream()
                .collect(Collectors.toMap(option -> option.id(), option -> option.name()));
        Set<Long> projectIds = projectNames.keySet();
        if (projectIds.isEmpty()) {
            return mapper.toPageResponse(null, org.springframework.data.domain.Page.empty(
                    PageRequest.of(query.page(), query.size(), buildSort(query.sort()))));
        }

        Instant deadlineFrom = null;
        Instant deadlineToExclusive = null;
        if (query.deadlineFrom() != null || query.deadlineTo() != null) {
            ZoneId zone = tenantSettingsPort.requireTimeZone(tenantId);
            if (query.deadlineFrom() != null) deadlineFrom = query.deadlineFrom().atStartOfDay(zone).toInstant();
            if (query.deadlineTo() != null) deadlineToExclusive = query.deadlineTo().plusDays(1).atStartOfDay(zone).toInstant();
        }
        Specification<Milestone> allowedProjects = (root, ignored, cb) -> root.get("projectId").in(projectIds);
        return mapper.toPageResponse(null, repository.findAll(
                MilestoneSpecifications.matching(tenantId, null, query.teamId(), search, query.status(),
                        query.mandatory(), query.latePolicyType(), deadlineFrom, deadlineToExclusive)
                        .and(allowedProjects).and(studentVisibility()),
                PageRequest.of(query.page(), query.size(), buildSort(query.sort()))), projectNames);
    }

    @Transactional(readOnly = true)
    public MilestonePageResponse getTeamList(Long teamId, MilestoneListQuery query) {
        String search = normalizeSearch(query.search());
        validateListQuery(query, search);
        Long tenantId = teamRead.requireTenant(teamId);
        scopeService.requireTeamScope(null, teamId, tenantId);
        return mapper.toPageResponse(null, repository.findAll(
                MilestoneSpecifications.matching(tenantId, null, teamId, search, query.status(),
                        query.mandatory(), query.latePolicyType(), null, null).and(studentVisibility()),
                PageRequest.of(query.page(), query.size(), buildSort(query.sort()))));
    }

    @Transactional(readOnly = true)
    public MilestoneDetailResponse getDetail(Long projectId, UUID milestoneId, Long teamId) {
        UUID actorId = actorProvider.requireCurrentActorId();
        Long tenantId = tenantProvider.requireCurrentTenantId();
        ProjectReadContext project = projectPort.requireProjectForRead(projectId, actorId, tenantId);
        accessPolicy.requireReadAccess(project);
        var milestone = repository.findByIdAndProjectIdAndTenantId(milestoneId, projectId, tenantId)
                .filter(m -> teamId == null || teamId.equals(m.getTeamId()))
                .filter(com.example.starter_project_2025.system.project.milestone.domain.Milestone::isActive)
                .filter(m -> !isStudent() || m.getStatus() != MilestoneStatus.PLANNED)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        var rubric = milestone.getRubricSnapshotId() == null ? null : rubricPort.requireSnapshotForRead(milestone.getRubricSnapshotId(), projectId, tenantId);
        var reviewer = milestone.getReviewerId() == null
                ? null
                : reviewerPort.requireReviewerForRead(milestone.getReviewerId(), projectId, tenantId);
        var tenantTimeZone = tenantSettingsPort.requireTimeZone(tenantId);
        return detailMapper.toResponse(milestone, project, rubric, reviewer, tenantTimeZone);
    }

    @Transactional(readOnly = true)
    public MilestoneDetailResponse getTeamDetail(Long teamId, UUID milestoneId) {
        Long tenantId = teamRead.requireTenant(teamId);
        var scope = scopeService.requireTeamScope(null, teamId, tenantId);
        var milestone = repository.findByIdAndTeamIdAndTenantId(milestoneId, teamId, tenantId)
                .filter(Milestone::isActive)
                .filter(m -> !isStudent() || m.getStatus() != MilestoneStatus.PLANNED)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        var rubric = milestone.getRubricSnapshotId() == null ? null : rubricPort.requireSnapshotForRead(milestone.getRubricSnapshotId(), scope.projectId(), tenantId);
        var reviewer = milestone.getReviewerId() == null ? null
                : reviewerPort.requireReviewerForRead(milestone.getReviewerId(), scope.projectId(), tenantId);
        return detailMapper.toResponse(milestone, null, rubric, reviewer,
                tenantSettingsPort.requireTimeZone(tenantId));
    }

    private Specification<Milestone> studentVisibility() {
        return (root, query, cb) -> isStudent() ? cb.notEqual(root.get("status"), MilestoneStatus.PLANNED) : cb.conjunction();
    }

    private boolean isStudent() {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_STUDENT") || authority.getAuthority().equals("ROLE_TRAINEE"));
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
        validateSort(query.sort(), errors);
        if (!errors.isEmpty()) {
            throw new MilestoneValidationException(errors);
        }
    }

    private Sort buildSort(List<String> requestedSort) {
        if (requestedSort == null || requestedSort.isEmpty()) {
            return Sort.by(Sort.Order.asc("deadline"), Sort.Order.asc("id"));
        }

        List<Sort.Order> orders = requestedSort.stream()
                .map(this::parseSort)
                .map(term -> new Sort.Order(term.direction(), SORT_FIELDS.get(term.field())))
                .toList();

        if (orders.stream().noneMatch(order -> order.getProperty().equals("id"))) {
            orders = new java.util.ArrayList<>(orders);
            orders.add(Sort.Order.asc("id"));
        }
        return Sort.by(orders);
    }

    private void validateSort(List<String> requestedSort, Map<String, List<String>> errors) {
        if (requestedSort == null) {
            return;
        }
        for (String value : requestedSort) {
            try {
                SortTerm term = parseSort(value);
                if (!SORT_FIELDS.containsKey(term.field())) {
                    throw new IllegalArgumentException();
                }
            } catch (IllegalArgumentException exception) {
                errors.put("sort", List.of("Sort must use a supported field and asc or desc direction"));
                return;
            }
        }
    }

    private SortTerm parseSort(String value) {
        if (value == null) {
            throw new IllegalArgumentException();
        }
        String[] parts = value.trim().split("[:,]", -1);
        if (parts.length != 2 || parts[0].isBlank()) {
            throw new IllegalArgumentException();
        }
        Sort.Direction direction = Sort.Direction.fromOptionalString(parts[1])
                .orElseThrow(IllegalArgumentException::new);
        return new SortTerm(parts[0], direction);
    }

    private record SortTerm(String field, Sort.Direction direction) {
    }

    private String normalizeSearch(String search) {
        if (search == null) {
            return null;
        }
        String normalized = search.trim().replaceAll("\\s+", " ");
        return normalized.isEmpty() ? null : normalized;
    }
}
