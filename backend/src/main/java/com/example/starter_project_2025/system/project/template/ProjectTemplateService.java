package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotService;
import com.example.starter_project_2025.system.project.project_template_version.TemplateVersionLifecycleService;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneScheduleValidator;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEvent;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Set;
import java.util.Map;
import java.util.List;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectTemplateService {
    private static final Set<String> SORT_FIELDS = Set.of("id", "code", "name", "category", "level",
            "estimatedDurationWeeks", "templateVersion", "status", "createdAt", "updatedAt");

    private final ProjectTemplateRepository templates;
    private final ProjectTemplateAuditRepository audits;
    private final ProjectTemplateAccessService access;
    private final ProjectTemplateValidator validator;
    private final TemplateMilestoneRepository milestones;
    private final TemplateMilestoneScheduleValidator scheduleValidator;
    private final TemplateTeamConstraintsMapper teamConstraintsMapper;
    private final ObjectMapper objectMapper;
    private final OutboxEventRepository events;
    private final TemplateConfigurationService configurations;
    private final TemplateVersionLifecycleService versionLifecycle;
    /** US-07: every template owns a version chain, seeded with its v1.0 baseline. */
    private final ProjectTemplateSnapshotService snapshotService;

    public ProjectTemplateOptions getOptions() {
        User user = access.requireUser("READ");
        return new ProjectTemplateOptions(user.getTenantId(), user.getTenant().getName(),
                categories(user.getTenantId()), access.can(user, "CREATE"), access.can(user, "UPDATE"),
                access.can(user, "ACTIVATE"), access.can(user, "ARCHIVE"));
    }

    public Page<ProjectTemplateResponse> getPage(String search, ProjectTemplateStatus status,
            ProjectTemplateLevel level, String category, Pageable pageable) {
        User user = access.requireUser("READ");
        if (pageable.getSort().stream().anyMatch(order -> !SORT_FIELDS.contains(order.getProperty()))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid sort field");
        }
        Specification<ProjectTemplate> filter = (root, query, builder) -> {
            var conditions = new ArrayList<Predicate>();
            // Tenant-scoped rows plus the shared catalogue (tenant_id is null),
            // so the seeded/sample templates are visible to every tenant.
            conditions.add(builder.or(
                    builder.isNull(root.get("tenantId")),
                    builder.equal(root.get("tenantId"), user.getTenantId())));
            conditions.add(builder.isTrue(root.get("isActive")));
            conditions.add(builder.or(builder.isNull(root.get("code")), builder.notEqual(root.get("code"), "MANUAL-GROUPING-DEFAULT")));
            if (status != null) conditions.add(builder.equal(root.get("status"), status));
            if (level != null) conditions.add(builder.equal(root.get("level"), level));
            if (category != null && !category.isBlank()) {
                conditions.add(builder.equal(root.get("category"), category.strip()));
            }
            if (search != null && !search.isBlank()) {
                String keyword = "%" + escapeSearch(search.strip().toLowerCase(Locale.ROOT)) + "%";
                conditions.add(builder.or(builder.like(builder.lower(root.get("code")), keyword, '\\'),
                        builder.like(builder.lower(root.get("name")), keyword, '\\')));
            }
            return builder.and(conditions.toArray(Predicate[]::new));
        };
        boolean canUpdate = access.can(user, "UPDATE");
        return templates.findAll(filter, pageable).map(template -> response(template, canUpdate));
    }

    public ProjectTemplateResponse getById(Long id) {
        User user = access.requireUser("READ");
        return response(findReadableTemplate(id, user), access.can(user, "UPDATE"));
    }

    @Transactional
    public ProjectTemplateResponse create(ProjectTemplateRequest request) {
        User user = access.requireUser("CREATE");
        validator.validate(request, false);
        requireCategory(request.category(), user.getTenantId());
        String code = request.code().strip();
        if (templates.existsByTenantIdAndCodeAndTemplateVersion(user.getTenantId(), code, 1)) {
            throw ProjectTemplateException.duplicateCode();
        }
        ProjectTemplate template = ProjectTemplate.builder().tenantId(user.getTenantId()).build();
        apply(template, request);
        template = templates.saveAndFlush(template);
        recordAudit(template, user, "PROJECT_TEMPLATE_CREATED", null);
        // US-07 / AC01: the template is born with its v1.0 DRAFT version.
        snapshotService.createInitialVersion(template);
        return response(template, access.can(user, "UPDATE"));
    }

    @Transactional
    public ProjectTemplateResponse update(Long id, ProjectTemplateRequest request) {
        User user = access.requireUser("UPDATE");
        ProjectTemplate template = findTemplate(id, user);
        if (template.getStatus() != ProjectTemplateStatus.DRAFT) {
            throw ProjectTemplateException.conflict("Only draft templates can be edited");
        }
        validator.validate(request, true);
        requireCategory(request.category(), user.getTenantId());
        if (!template.getLockVersion().equals(request.lockVersion().longValueExact())) {
            throw ProjectTemplateException.conflict("This template has changed. Reload it before saving your changes");
        }
        String code = request.code().strip();
        if (templates.existsByTenantIdAndCodeAndTemplateVersionAndIdNot(
                template.getTenantId(), code, template.getTemplateVersion(), id)) {
            throw ProjectTemplateException.duplicateCode();
        }
        scheduleValidator.validateDuration(request.estimatedDurationWeeks().intValueExact(),
                milestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(id));
        String beforeState = state(template);
        apply(template, request);
        template = templates.saveAndFlush(template);
        configurations.refreshDraft(template);
        recordAudit(template, user, "PROJECT_TEMPLATE_UPDATED", beforeState);
        return response(template, true);
    }

    @Transactional
    public ProjectTemplateResponse updateTeamConstraints(Long id, TemplateTeamConstraintsRequest request) {
        User user = access.requireUser("UPDATE");
        ProjectTemplate template = findTemplate(id, user);
        if (template.getStatus() != ProjectTemplateStatus.DRAFT) {
            throw ProjectTemplateException.conflict("Only draft templates can be edited");
        }
        validator.validateTeamConstraints(request);
        if (!template.getLockVersion().equals(request.lockVersion().longValueExact())) {
            throw ProjectTemplateException.conflict("This template has changed. Reload it before saving your changes");
        }
        String beforeState = state(template);
        template.setConstraintsJson(teamConstraintsMapper.write(template.getConstraintsJson(), request));
        template.setUpdatedAt(LocalDateTime.now());
        template = templates.saveAndFlush(template);
        configurations.refreshDraft(template);
        recordAudit(template, user, "PROJECT_TEMPLATE_TEAM_RULES_UPDATED", beforeState);
        return response(template, true);
    }

    @Transactional
    public ProjectTemplateResponse archive(Long id, TemplateArchiveRequest request) {
        User user = access.requireUser("ARCHIVE");
        ProjectTemplate template = findTemplate(id, user);
        if (template.getStatus() != ProjectTemplateStatus.ACTIVE) {
            throw ProjectTemplateException.conflict("Only active templates can be archived");
        }
        requireArchiveRevision(request);
        if (!template.getLockVersion().equals(request.lockVersion().longValueExact())) {
            throw ProjectTemplateException.conflict("This template has changed. Reload it before archiving");
        }
        String before = state(template);
        versionLifecycle.archivePublishedVersions(id, null, user.getEmail());
        template.setStatus(ProjectTemplateStatus.ARCHIVED);
        templates.saveAndFlush(template);
        recordAudit(template, user, "PROJECT_TEMPLATE_ARCHIVED", before);
        Long tenantId = tenantOf(template, user);
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    "templateId", id, "tenantId", tenantId, "actorId", user.getId(),
                    "correlationId", CorrelationIdFilter.currentId(), "template", objectMapper.readTree(state(template))));
            events.save(OutboxEvent.templateArchived(tenantId, id, payload, Instant.now()));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to record template archive event", exception);
        }
        return response(template, false);
    }

    private void requireArchiveRevision(TemplateArchiveRequest request) {
        try {
            if (request != null && request.lockVersion() != null && request.lockVersion().longValueExact() >= 0) return;
        } catch (ArithmeticException ignored) {
        }
        String message = "A valid template revision is required. Please reload the template";
        throw new ProjectTemplateException(422, message, Map.of("lockVersion", List.of(message)));
    }

    private ProjectTemplateResponse response(ProjectTemplate template, boolean canUpdate) {
        return ProjectTemplateResponse.from(template, canUpdate, teamConstraintsMapper.read(template.getConstraintsJson()));
    }

    private ProjectTemplate findTemplate(Long id, User user) {
        return templates.findForTemplateUpdate(id, user.getTenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
    }

    private ProjectTemplate findReadableTemplate(Long id, User user) {
        return templates.findReadableById(id, user.getTenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
    }

    /** Audit/event tenant: shared rows are recorded under the acting user's tenant. */
    private Long tenantOf(ProjectTemplate template, User user) {
        return template.getTenantId() != null ? template.getTenantId() : user.getTenantId();
    }

    private List<String> categories(Long tenantId) {
        return java.util.stream.Stream.concat(java.util.stream.Stream.of("Web Application", "Mobile Application", "Data Analytics", "Capstone", "Cross-functional"),
                templates.findCategories(tenantId).stream()).filter(value -> value != null && !value.isBlank())
                .distinct().sorted().toList();
    }

    private void requireCategory(String category, Long tenantId) {
        if (!categories(tenantId).contains(category.strip())) {
            throw new ProjectTemplateException(422, "Select a category from the list", Map.of("category", List.of("Select an available category")));
        }
    }

    private void apply(ProjectTemplate template, ProjectTemplateRequest request) {
        template.setCode(request.code().strip());
        template.setName(request.name().strip());
        template.setDescription(request.description().strip());
        template.setCategory(request.category().strip());
        template.setLevel(request.level());
        template.setEstimatedDurationWeeks(request.estimatedDurationWeeks().intValueExact());
    }

    private void recordAudit(ProjectTemplate template, User user, String action, String beforeState) {
        audits.save(new ProjectTemplateAudit(tenantOf(template, user), template.getId(), user.getId(),
                action, beforeState, state(template), CorrelationIdFilter.currentId()));
    }

    private String state(ProjectTemplate template) {
        try {
            return objectMapper.writeValueAsString(response(template, false));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to record project template changes", exception);
        }
    }

    private String escapeSearch(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
