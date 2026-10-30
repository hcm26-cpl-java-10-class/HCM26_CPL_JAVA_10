package com.example.starter_project_2025.system.project.template.version;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.project_template_version.*;
import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditService;
import com.example.starter_project_2025.system.project.project_template_version.event.ProjectTemplateSnapshotOutboxService;
import com.example.starter_project_2025.system.project.template.*;
import com.example.starter_project_2025.system.project.template.assignment.TemplateBriefSnapshotWriter;
import com.example.starter_project_2025.system.project.template.content.*;
import com.example.starter_project_2025.system.project.template.milestone.*;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateVersionConfigurationService {
    private final ProjectTemplateRepository templates;
    private final ProjectRepository projects;
    private final ProjectTemplateSnapshotRepository versions;
    private final ProjectTemplateSnapshotMapper versionMapper;
    private final ProjectTemplateAccessService access;
    private final TemplateConfigurationService configurations;
    private final ProjectTemplateValidator overviewValidator;
    private final TemplateTeamConstraintsMapper teams;
    private final TemplateMilestoneValidator milestoneValidator;
    private final TemplateMilestoneScheduleValidator scheduleValidator;
    private final TemplateMilestoneRubrics rubrics;
    private final TemplateSampleContentValidator sampleValidator;
    private final TemplateBacklogImportPolicy importPolicy;
    private final TemplateBacklogImportService imports;
    private final ProjectTemplateSnapshotAuditService audits;
    private final ProjectTemplateSnapshotOutboxService events;
    private final ProjectTemplateAuditRepository templateAudits;
    private final ObjectMapper json;
    private final EntityManager entityManager;
    private final TemplateVersionLifecycleService lifecycle;

    public TemplateVersionConfigurationResponse get(Long id) {
        User user = access.requireUser("READ");
        ProjectTemplateSnapshot version = version(id);
        ProjectTemplate owner = templates.findReadableById(version.getTemplateId(), user.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Project template was not found"));
        requireTemplateVersion(version);
        return response(owner, version, user);
    }

    public boolean isReusableVersion(ProjectTemplateSnapshot version) {
        if (version.getProjectId() != null) return false;
        try {
            return !TemplateBriefSnapshotWriter.PURPOSE_TEAM_ASSIGNMENT.equals(
                    configurations.read(version.getContentJson()).path("purpose").asText());
        } catch (ProjectTemplateException exception) {
            return true;
        }
    }

    public TemplateVersionListItem listItem(ProjectTemplate owner, ProjectTemplateSnapshot version, User user, boolean latest) {
        ProjectTemplate view;
        boolean validContent = true;
        try {
            view = configurations.view(owner, version);
        } catch (ProjectTemplateException exception) {
            validContent = false;
            view = ProjectTemplate.builder().id(owner.getId()).tenantId(owner.getTenantId())
                    .code(owner.getCode()).name(owner.getName()).description(owner.getDescription())
                    .category(owner.getCategory()).level(owner.getLevel()).estimatedDurationWeeks(owner.getEstimatedDurationWeeks())
                    .templateVersion(owner.getTemplateVersion()).constraintsJson(owner.getConstraintsJson())
                    .status(version.getStatus() == ProjectTemplateVersionStatus.DRAFT ? ProjectTemplateStatus.DRAFT
                            : version.getStatus() == ProjectTemplateVersionStatus.PUBLISHED ? ProjectTemplateStatus.ACTIVE : ProjectTemplateStatus.ARCHIVED)
                    .lockVersion(owner.getLockVersion()).createdAt(version.getCreatedAt()).updatedAt(version.getUpdatedAt()).build();
        }
        if (owner.getStatus() == ProjectTemplateStatus.ARCHIVED) view.setStatus(ProjectTemplateStatus.ARCHIVED);
        boolean canEdit = validContent && canEdit(owner, version, user, latest);
        return new TemplateVersionListItem(ProjectTemplateResponse.from(view, canEdit, teams.read(view.getConstraintsJson())),
                version.getId(), version.getVersion(), latest, owner.getStatus());
    }

    public List<TemplateSampleContentRequest.BacklogItem> previewImport(Long id, org.springframework.web.multipart.MultipartFile file) {
        if (!get(id).editable()) throw new AccessDeniedException("Only the latest draft version can import backlog items");
        return imports.previewFile(file);
    }

    public byte[] importTemplate(Long id) {
        if (!get(id).editable()) throw new AccessDeniedException("Only the latest draft version can import backlog items");
        return imports.templateFile();
    }

    @Transactional
    public TemplateVersionConfigurationResponse saveOverview(Long id, ProjectTemplateRequest request) {
        var context = editable(id, request.lockVersion());
        overviewValidator.validate(request, true);
        requireCategory(request.category(), context.user().getTenantId());
        if (templates.existsByTenantIdAndCodeAndTemplateVersionAndIdNot(context.user().getTenantId(), request.code().strip(),
                context.owner().getTemplateVersion(), context.owner().getId())) throw ProjectTemplateException.duplicateCode();
        var content = configurations.read(context.version().getContentJson());
        content.put("code", request.code().strip());
        content.put("name", request.name().strip());
        content.put("description", request.description().strip());
        content.put("category", request.category().strip());
        content.put("level", request.level().name());
        content.put("estimatedDurationWeeks", request.estimatedDurationWeeks().intValueExact());
        scheduleValidator.validate(plan(content, request.lockVersion()), request.estimatedDurationWeeks().intValueExact());
        return save(context, content);
    }

    @Transactional
    public TemplateVersionConfigurationResponse saveTeam(Long id, TemplateTeamConstraintsRequest request) {
        var context = editable(id, request.lockVersion());
        overviewValidator.validateTeamConstraints(request);
        var content = configurations.read(context.version().getContentJson());
        content.set("constraints", configurations.read(teams.write(content.path("constraints").toString(), request)));
        return save(context, content);
    }

    @Transactional
    public TemplateVersionConfigurationResponse saveMilestones(Long id, TemplateMilestonePlanRequest request) {
        var context = editable(id, request.lockVersion());
        milestoneValidator.validate(request);
        var content = configurations.read(context.version().getContentJson());
        scheduleValidator.validate(request, duration(content));
        rubrics.requirePublished(request, context.user().getTenantId());
        var updated = json.valueToTree(request.milestones());
        for (var item : updated) {
            for (var saved : content.path("milestones")) {
                boolean sameId = item.hasNonNull("id") && saved.hasNonNull("id") && item.path("id").asLong() == saved.path("id").asLong();
                boolean legacyMatch = !item.hasNonNull("id") && !saved.hasNonNull("id") && item.path("title").equals(saved.path("title"));
                if (sameId || legacyMatch) {
                    var criteria = saved.has("rubricCriteria") ? saved.get("rubricCriteria") : saved.get("legacyRubricCriteria");
                    if (criteria != null) ((ObjectNode) item).set("rubricCriteria", criteria.deepCopy());
                    break;
                }
            }
        }
        content.set("milestones", updated);
        return save(context, content);
    }

    @Transactional
    public TemplateVersionConfigurationResponse saveBacklog(Long id, TemplateSampleContentRequest request) {
        var context = editable(id, request.lockVersion());
        sampleValidator.validate(request);
        var content = configurations.read(context.version().getContentJson());
        content.set("backlogItems", json.valueToTree(request.backlogItems()));
        return save(context, content);
    }

    @Transactional
    public TemplateVersionConfigurationResponse publish(Long id, TemplateActivationRequest request) {
        User actor = access.requireUser("ACTIVATE");
        var context = editable(id, request.lockVersion(), actor);
        ObjectNode content = configurations.read(context.version().getContentJson());
        validate(content, request.lockVersion(), context.user().getTenantId(), true);
        String beforeTemplate = configurations.capture(context.owner());
        Map<String, Object> beforeVersion = state(context.version());
        lifecycle.archivePublishedVersions(context.owner().getId(), context.version().getId(), actor.getEmail());
        configurations.apply(context.owner(), content);
        context.owner().syncVersion(configurations.view(context.owner(), context.version()).getTemplateVersion());
        context.owner().setStatus(ProjectTemplateStatus.ACTIVE);
        context.owner().setUpdatedAt(LocalDateTime.now());
        templates.saveAndFlush(context.owner());
        context.version().setContentJson(configurations.capture(context.owner()));
        context.version().setStatus(ProjectTemplateVersionStatus.PUBLISHED);
        versions.saveAndFlush(context.version());
        templateAudits.save(new ProjectTemplateAudit(context.owner().getTenantId(), context.owner().getId(), actor.getId(),
                "PROJECT_TEMPLATE_VERSION_PUBLISHED", beforeTemplate, context.version().getContentJson(), CorrelationIdFilter.currentId()));
        record("PUBLISH", context, beforeVersion);
        return response(context.owner(), context.version(), actor);
    }

    @Transactional
    public void synchronizeDraft(ProjectTemplateSnapshot version) {
        User user = access.requireUser("UPDATE");
        ProjectTemplate owner = templates.findForTemplateUpdate(version.getTemplateId(), user.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Project template was not found"));
        if (version.getStatus() != ProjectTemplateVersionStatus.DRAFT) return;
        ObjectNode content = configurations.read(version.getContentJson());
        if (!canonical(content)) return;
        validate(content, BigDecimal.valueOf(owner.getLockVersion()), user.getTenantId(), false);
        if (owner.getStatus() == ProjectTemplateStatus.DRAFT && latest(owner, version)) {
            configurations.apply(owner, content);
            version.setContentJson(configurations.capture(owner));
        }
        owner.setUpdatedAt(LocalDateTime.now());
        templates.saveAndFlush(owner);
    }

    private TemplateVersionConfigurationResponse save(EditContext context, ObjectNode content) {
        Map<String, Object> before = state(context.version());
        context.version().setContentJson(configurations.writeConfiguration(content));
        if (context.owner().getStatus() == ProjectTemplateStatus.DRAFT) {
            configurations.apply(context.owner(), content);
        }
        context.owner().setUpdatedAt(LocalDateTime.now());
        templates.saveAndFlush(context.owner());
        if (context.owner().getStatus() == ProjectTemplateStatus.DRAFT) {
            context.version().setContentJson(configurations.capture(context.owner()));
        }
        versions.saveAndFlush(context.version());
        record("UPDATE_CONFIGURATION", context, before);
        return response(context.owner(), context.version(), context.user());
    }

    private void validate(ObjectNode content, BigDecimal revision, Long tenantId, boolean complete) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        check(errors, () -> overviewValidator.validate(overview(content, revision), true));
        if (complete || content.path("constraints").hasNonNull("min_members")) {
            check(errors, () -> overviewValidator.validateTeamConstraints(team(content, revision)));
        }
        var plan = plan(content, revision);
        if (complete || plan.milestones() != null && !plan.milestones().isEmpty()) {
            check(errors, () -> milestoneValidator.validate(plan));
            check(errors, () -> scheduleValidator.validate(plan, duration(content)));
            if (complete && errors.isEmpty()) check(errors, () -> rubrics.requirePublished(plan, tenantId));
        }
        check(errors, () -> sampleValidator.validate(sample(content, revision)));
        if (!errors.isEmpty()) throw new ProjectTemplateException(422, "Complete the highlighted configuration before publishing", errors);
    }

    private void check(Map<String, List<String>> errors, Runnable validation) {
        try { validation.run(); }
        catch (ProjectTemplateException exception) { errors.putAll(exception.getErrors()); }
    }

    private EditContext editable(Long id, BigDecimal revision) {
        return editable(id, revision, access.requireUser("UPDATE"));
    }

    private EditContext editable(Long id, BigDecimal revision, User user) {
        var version = version(id);
        var owner = templates.findForTemplateUpdate(version.getTemplateId(), user.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Project template was not found"));
        entityManager.refresh(version);
        requireTemplateVersion(version);
        if (projects.existsByTemplateSnapshotIdIn(List.of(version.getId()))) {
            throw ProjectTemplateException.conflict("This version is already used by a project. Create a new version instead");
        }
        if (owner.getStatus() == ProjectTemplateStatus.ARCHIVED || version.getStatus() != ProjectTemplateVersionStatus.DRAFT
                || !Boolean.TRUE.equals(version.getIsActive()) || !latest(owner, version)) {
            throw ProjectTemplateException.conflict("Only the latest draft version can be edited or published");
        }
        if (!canonical(configurations.read(version.getContentJson()))) {
            throw new ProjectTemplateException(422, "This legacy version is read-only. Duplicate it to create a complete template", Map.of());
        }
        try {
            if (revision == null || revision.longValueExact() < 0) throw new ArithmeticException();
        } catch (ArithmeticException exception) {
            throw new ProjectTemplateException(422, "A valid template revision is required", Map.of("lockVersion", List.of("Reload the version before saving")));
        }
        if (!Objects.equals(owner.getLockVersion(), revision.longValueExact())) {
            throw ProjectTemplateException.conflict("This template has changed. Reload it before saving your changes");
        }
        return new EditContext(owner, version, user);
    }

    private ProjectTemplateSnapshot version(Long id) {
        return versions.findById(id).orElseThrow(() -> new ResourceNotFoundException("Template version was not found"));
    }

    private void requireTemplateVersion(ProjectTemplateSnapshot version) {
        var content = configurations.read(version.getContentJson());
        if (version.getProjectId() != null || TemplateBriefSnapshotWriter.PURPOSE_TEAM_ASSIGNMENT.equals(content.path("purpose").asText())) {
            throw new AccessDeniedException("Workspace snapshots cannot be edited as template versions");
        }
    }

    private boolean latest(ProjectTemplate owner, ProjectTemplateSnapshot version) {
        return versions.findByTemplateIdOrderByCreatedAtDesc(owner.getId()).stream()
                .filter(item -> item.getProjectId() == null && Boolean.TRUE.equals(item.getIsActive()))
                .filter(item -> !TemplateBriefSnapshotWriter.PURPOSE_TEAM_ASSIGNMENT.equals(configurations.read(item.getContentJson()).path("purpose").asText()))
                .findFirst().map(item -> item.getId().equals(version.getId())).orElse(false);
    }

    private boolean canonical(ObjectNode content) {
        return content.has("description") && content.has("category") && content.has("level") && content.has("estimatedDurationWeeks")
                && content.path("constraints").isObject() && content.path("milestones").isArray() && content.path("backlogItems").isArray();
    }

    private TemplateVersionConfigurationResponse response(ProjectTemplate owner, ProjectTemplateSnapshot version, User user) {
        var content = configurations.read(version.getContentJson());
        var view = configurations.view(owner, version);
        boolean legacy = !canonical(content);
        boolean usedByProject = projects.existsByTemplateSnapshotIdIn(List.of(version.getId()));
        boolean editable = canEdit(owner, version, user, latest(owner, version));
        var overview = ProjectTemplateResponse.from(view, editable, teams.read(view.getConstraintsJson()));
        view.setTenantId(user.getTenantId());
        var milestones = TemplateMilestonePlanResponse.from(view, configurations.milestoneView(view, content), editable, user.getTenantId());
        var backlog = TemplateSampleContentResponse.from(view, configurations.backlogView(view, content), editable, importPolicy.maxBytes());
        var dto = versionMapper.toResponse(version);
        dto.setTemplateName(owner.getName());
        return new TemplateVersionConfigurationResponse(dto, overview, milestones, backlog, editable,
                !legacy && owner.getTenantId() != null && owner.getStatus() != ProjectTemplateStatus.ARCHIVED
                        && !usedByProject
                        && version.getStatus() == ProjectTemplateVersionStatus.DRAFT && latest(owner, version) && access.can(user, "ACTIVATE"), legacy);
    }

    private boolean canEdit(ProjectTemplate owner, ProjectTemplateSnapshot version, User user, boolean latest) {
        return latest && owner.getTenantId() != null && owner.getStatus() != ProjectTemplateStatus.ARCHIVED
                && version.getStatus() == ProjectTemplateVersionStatus.DRAFT && Boolean.TRUE.equals(version.getIsActive())
                && access.can(user, "UPDATE") && canonical(configurations.read(version.getContentJson()))
                && !projects.existsByTemplateSnapshotIdIn(List.of(version.getId()));
    }

    private ProjectTemplateRequest overview(ObjectNode content, BigDecimal revision) {
        return new ProjectTemplateRequest(text(content, "code"), text(content, "name"), text(content, "description"),
                text(content, "category"), convert(content.path("level"), ProjectTemplateLevel.class),
                content.path("estimatedDurationWeeks").isNumber() ? content.path("estimatedDurationWeeks").decimalValue() : null, revision);
    }

    private TemplateTeamConstraintsRequest team(ObjectNode content, BigDecimal revision) {
        var rules = teams.read(content.path("constraints").toString());
        if (rules == null) throw new ProjectTemplateException(422, "Configure team constraints", Map.of("teamConstraints", List.of("Configure team size and role quotas")));
        return new TemplateTeamConstraintsRequest(BigDecimal.valueOf(rules.minMembers()), BigDecimal.valueOf(rules.maxMembers()),
                new TemplateTeamConstraintsRequest.RoleQuotas(BigDecimal.valueOf(rules.roleQuotas().pm()), BigDecimal.valueOf(rules.roleQuotas().ba()),
                        BigDecimal.valueOf(rules.roleQuotas().dev()), BigDecimal.valueOf(rules.roleQuotas().qa())), rules.allowMultiRole(), revision);
    }

    private TemplateMilestonePlanRequest plan(ObjectNode content, BigDecimal revision) {
        var input = json.createObjectNode().put("lockVersion", revision);
        input.set("milestones", content.path("milestones"));
        return convert(input, TemplateMilestonePlanRequest.class);
    }

    private TemplateSampleContentRequest sample(ObjectNode content, BigDecimal revision) {
        var input = json.createObjectNode().put("lockVersion", revision);
        input.set("backlogItems", content.path("backlogItems"));
        return convert(input, TemplateSampleContentRequest.class);
    }

    private Integer duration(ObjectNode content) {
        return content.path("estimatedDurationWeeks").canConvertToInt() ? content.path("estimatedDurationWeeks").intValue() : null;
    }

    private void requireCategory(String category, Long tenantId) {
        var available = java.util.stream.Stream.concat(java.util.stream.Stream.of("Web Application", "Mobile Application", "Data Analytics", "Capstone", "Cross-functional"),
                templates.findCategories(tenantId).stream()).toList();
        if (!available.contains(category.strip())) {
            throw new ProjectTemplateException(422, "Select a category from the list", Map.of("category", List.of("Select an available category")));
        }
    }

    private String text(ObjectNode content, String key) { return content.hasNonNull(key) ? content.get(key).asText() : null; }

    private <T> T convert(com.fasterxml.jackson.databind.JsonNode content, Class<T> type) {
        try { return json.readerFor(type).without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(content); }
        catch (java.io.IOException exception) {
            throw new ProjectTemplateException(422, "This version contains invalid template configuration", Map.of("request", List.of("Correct the saved configuration before continuing")));
        }
    }

    private Map<String, Object> state(ProjectTemplateSnapshot version) {
        return Map.of("id", version.getId(), "templateId", version.getTemplateId(), "version", version.getVersion(),
                "status", version.getStatus(), "contentJson", version.getContentJson());
    }

    private void record(String action, EditContext context, Map<String, Object> before) {
        var after = state(context.version());
        audits.record(action, context.version().getId(), context.owner().getId(), null, before, after);
        events.enqueue("PROJECT_TEMPLATE_VERSION_UPDATED", context.version().getId(), context.owner().getId(), null, context.user().getEmail(), after);
    }

    private record EditContext(ProjectTemplate owner, ProjectTemplateSnapshot version, User user) { }
}
