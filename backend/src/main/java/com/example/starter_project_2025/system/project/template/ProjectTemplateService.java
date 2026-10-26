package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Set;
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
    private final TemplateTeamConstraintsMapper teamConstraintsMapper;
    private final ObjectMapper objectMapper;

    public ProjectTemplateOptions getOptions() {
        User user = access.requireUser("READ");
        return new ProjectTemplateOptions(user.getTenantId(), user.getTenant().getName(),
                templates.findCategories(user.getTenantId()), access.can(user, "CREATE"), access.can(user, "UPDATE"));
    }

    public Page<ProjectTemplateResponse> getPage(String search, ProjectTemplateStatus status,
            ProjectTemplateLevel level, String category, Pageable pageable) {
        User user = access.requireUser("READ");
        if (pageable.getSort().stream().anyMatch(order -> !SORT_FIELDS.contains(order.getProperty()))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid sort field");
        }
        Specification<ProjectTemplate> filter = (root, query, builder) -> {
            var conditions = new ArrayList<Predicate>();
            conditions.add(builder.equal(root.get("tenantId"), user.getTenantId()));
            conditions.add(builder.isTrue(root.get("isActive")));
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
        return response(findTemplate(id, user), access.can(user, "UPDATE"));
    }

    @Transactional
    public ProjectTemplateResponse create(ProjectTemplateRequest request) {
        User user = access.requireUser("CREATE");
        validator.validate(request, false);
        String code = request.code().strip();
        if (templates.existsByTenantIdAndCodeAndTemplateVersion(user.getTenantId(), code, 1)) {
            throw ProjectTemplateException.duplicateCode();
        }
        ProjectTemplate template = ProjectTemplate.builder().tenantId(user.getTenantId()).build();
        apply(template, request);
        template = templates.saveAndFlush(template);
        recordAudit(template, user, "PROJECT_TEMPLATE_CREATED", null);
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
        if (!template.getLockVersion().equals(request.lockVersion().longValueExact())) {
            throw ProjectTemplateException.conflict("This template has changed. Reload it before saving your changes");
        }
        String code = request.code().strip();
        if (templates.existsByTenantIdAndCodeAndTemplateVersionAndIdNot(
                user.getTenantId(), code, template.getTemplateVersion(), id)) {
            throw ProjectTemplateException.duplicateCode();
        }
        String beforeState = state(template);
        apply(template, request);
        template = templates.saveAndFlush(template);
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
        recordAudit(template, user, "PROJECT_TEMPLATE_TEAM_RULES_UPDATED", beforeState);
        return response(template, true);
    }

    private ProjectTemplateResponse response(ProjectTemplate template, boolean canUpdate) {
        return ProjectTemplateResponse.from(template, canUpdate, teamConstraintsMapper.read(template.getConstraintsJson()));
    }

    private ProjectTemplate findTemplate(Long id, User user) {
        return templates.findByIdAndTenantIdAndIsActiveTrue(id, user.getTenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
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
        audits.save(new ProjectTemplateAudit(template.getTenantId(), template.getId(), user.getId(),
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
