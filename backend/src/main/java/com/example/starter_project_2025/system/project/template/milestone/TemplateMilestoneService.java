package com.example.starter_project_2025.system.project.template.milestone;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.milestone.dto.response.RubricOptionResponse;
import com.example.starter_project_2025.system.project.milestone.integration.port.TenantSettingsPort;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import com.example.starter_project_2025.system.project.template.artifact.TemplateArtifactRequirementRepository;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAccessService;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAudit;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAuditRepository;
import com.example.starter_project_2025.system.project.template.ProjectTemplateException;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateMilestoneService {
    private final ProjectTemplateRepository templates;
    private final TemplateMilestoneRepository milestones;
    private final ProjectTemplateAccessService access;
    private final ProjectTemplateAuditRepository audits;
    private final TemplateMilestoneValidator validator;
    private final TemplateMilestoneScheduleValidator scheduleValidator;
    private final ObjectMapper objectMapper;
    private final RubricCatalogService rubricCatalog;
    private final TemplateMilestoneRubrics rubrics;
    private final TemplateMilestoneMapper mapper;
    private final TenantSettingsPort milestoneTenantSettings;
    private final TemplateArtifactRequirementRepository artifactRequirements;
    private final com.example.starter_project_2025.system.project.template.TemplateConfigurationService configurations;

    public List<TemplateMilestoneCreation> prepareForProject(Long templateId, Long teamId, Instant startsAt) {
        User user = access.requireUser("READ");
        ProjectTemplate template = findReadableTemplate(templateId, user);
        if (template.getStatus() != ProjectTemplateStatus.ACTIVE) {
            throw ProjectTemplateException.conflict("Only active templates can be used to create a project");
        }
        if (teamId == null || teamId <= 0 || startsAt == null) {
            throw new ProjectTemplateException(422, "Provide a team and project start date", Map.of());
        }
        List<TemplateMilestone> plan = loadMilestones(templateId);
        var request = TemplateMilestonePlanRequest.from(template.getLockVersion(), plan);
        validator.validate(request);
        scheduleValidator.validate(request, template.getEstimatedDurationWeeks());
        rubrics.requirePublished(request, tenantOf(template, user));
        var zone = milestoneTenantSettings.requireTimeZone(tenantOf(template, user));
        return plan.stream().map(item -> mapper.forProject(item, teamId, startsAt, zone)).toList();
    }

    public TemplateMilestoneOptions getOptions(Long templateId) {
        User user = access.requireUser("READ");
        findReadableTemplate(templateId, user);
        return new TemplateMilestoneOptions(rubricCatalog.findPublished(user.getTenantId()).stream()
                .map(RubricCatalogService::snapshot).map(RubricOptionResponse::from).toList());
    }

    public TemplateMilestonePlanResponse getPlan(Long templateId) {
        User user = access.requireUser("READ");
        ProjectTemplate template = findReadableTemplate(templateId, user);
        return TemplateMilestonePlanResponse.from(template,
                loadMilestones(templateId), access.can(user, "UPDATE") && template.getTenantId() != null,
                tenantOf(template, user));
    }

    @Transactional
    public TemplateMilestonePlanResponse savePlan(Long templateId, TemplateMilestonePlanRequest request) {
        User user = access.requireUser("UPDATE");
        ProjectTemplate template = findTemplate(templateId, user);
        if (template.getStatus() != ProjectTemplateStatus.DRAFT) {
            throw ProjectTemplateException.conflict("Only draft templates can be edited");
        }
        validator.validate(request);
        if (!template.getLockVersion().equals(request.lockVersion().longValueExact())) {
            throw ProjectTemplateException.conflict("This template has changed. Reload it before saving your changes");
        }

        List<TemplateMilestone> existing = loadMilestones(templateId);
        Map<Long, TemplateMilestone> byId = existing.stream()
                .collect(Collectors.toMap(TemplateMilestone::getId, Function.identity()));
        checkReferences(request, byId);
        Set<Long> retainedMilestones = request.milestones().stream().map(TemplateMilestonePlanRequest.Milestone::savedId)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        var removedIds = existing.stream().map(TemplateMilestone::getId).filter(id -> !retainedMilestones.contains(id)).toList();
        scheduleValidator.validate(request, template.getEstimatedDurationWeeks());
        Long tenantId = tenantOf(template, user);
        var rubricVersions = rubrics.requirePublished(request, tenantId);
        String before = state(template, existing, tenantId);

        template.setUpdatedAt(LocalDateTime.now());
        template = templates.saveAndFlush(template);
        List<TemplateMilestone> updated = new ArrayList<>();
        for (int index = 0; index < request.milestones().size(); index++) {
            var input = request.milestones().get(index);
            TemplateMilestone milestone = input.id() == null ? new TemplateMilestone() : byId.get(input.savedId());
            milestone.setTemplate(template);
            milestone.setTitle(input.title().strip());
            milestone.setDescription(input.description() == null ? null : input.description().strip());
            milestone.setDueAfter(input.dueAfter().intValueExact());
            milestone.setDueUnit(input.dueUnit());
            milestone.setWeight(input.weight());
            milestone.setMandatory(input.mandatory());
            milestone.setRubricVersion(rubricVersions.get(input.rubricVersionId()));
            milestone.setOrderIndex(index);
            updateChecklist(milestone, input.checklistItems());
            if (input.latePolicy() != null) updateLatePolicy(milestone, input.latePolicy());
            updated.add(milestone);
        }
        Set<Long> retainedIds = request.milestones().stream().map(TemplateMilestonePlanRequest.Milestone::savedId)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        if (!removedIds.isEmpty()) artifactRequirements.deleteByMilestone_IdIn(removedIds);
        milestones.deleteAll(existing.stream().filter(item -> !retainedIds.contains(item.getId())).toList());
        List<TemplateMilestone> saved = milestones.saveAllAndFlush(updated);
        configurations.refreshDraft(template);
        audits.save(new ProjectTemplateAudit(template.getTenantId(), templateId, user.getId(),
                "PROJECT_TEMPLATE_MILESTONES_UPDATED", before, state(template, saved, tenantId), CorrelationIdFilter.currentId()));
        return TemplateMilestonePlanResponse.from(template, saved, true, tenantId);
    }

    private void updateLatePolicy(TemplateMilestone milestone, TemplateMilestonePlanRequest.LatePolicy policy) {
        milestone.setAllowLateSubmission(policy.allowLateSubmission());
        milestone.setMaxLateDays(policy.allowLateSubmission() ? policy.maxLateDays().intValueExact() : 0);
        milestone.setPenaltyPerDayPercent(policy.allowLateSubmission() ? policy.penaltyPerDayPercent() : java.math.BigDecimal.ZERO);
    }

    private void checkReferences(TemplateMilestonePlanRequest request, Map<Long, TemplateMilestone> existing) {
        for (var input : request.milestones()) {
            TemplateMilestone milestone = input.id() == null ? null : existing.get(input.savedId());
            if (input.id() != null && milestone == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "A selected template milestone was not found");
            }
            Set<Long> checklistIds = milestone == null ? Set.of() : milestone.getChecklistItems().stream()
                    .map(TemplateMilestoneChecklistItem::getId).collect(Collectors.toSet());
            if (input.checklistItems().stream().anyMatch(item -> item.id() != null && !checklistIds.contains(item.savedId()))) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "A selected checklist item was not found in this milestone");
            }
        }
    }

    private List<TemplateMilestone> loadMilestones(Long templateId) {
        List<TemplateMilestone> items = milestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(templateId);
        if (!items.isEmpty()) milestones.findWithRubricCriteria(templateId);
        return items;
    }

    private void updateChecklist(TemplateMilestone milestone, List<TemplateMilestonePlanRequest.ChecklistItem> inputs) {
        Map<Long, TemplateMilestoneChecklistItem> byId = milestone.getChecklistItems().stream()
                .collect(Collectors.toMap(TemplateMilestoneChecklistItem::getId, Function.identity()));
        Set<Long> retainedIds = inputs.stream().map(TemplateMilestonePlanRequest.ChecklistItem::savedId)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        milestone.getChecklistItems().removeIf(item -> !retainedIds.contains(item.getId()));
        for (int index = 0; index < inputs.size(); index++) {
            var input = inputs.get(index);
            TemplateMilestoneChecklistItem item = input.id() == null ? new TemplateMilestoneChecklistItem() : byId.get(input.savedId());
            if (input.id() == null) milestone.getChecklistItems().add(item);
            item.setMilestone(milestone);
            item.setContent(input.content().strip());
            item.setMandatory(input.mandatory());
            item.setOrderIndex(index);
        }
        milestone.getChecklistItems().sort(Comparator.comparing(TemplateMilestoneChecklistItem::getOrderIndex));
    }

    private ProjectTemplate findTemplate(Long templateId, User user) {
        return templates.findForTemplateUpdate(templateId, user.getTenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
    }

    /** Read-only: also resolves the shared catalogue ({@code tenant_id is null}). */
    private ProjectTemplate findReadableTemplate(Long templateId, User user) {
        return templates.findReadableById(templateId, user.getTenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
    }

    /** Audit/rubric tenant: shared rows use the acting user's tenant. */
    private Long tenantOf(ProjectTemplate template, User user) {
        return template.getTenantId() != null ? template.getTenantId() : user.getTenantId();
    }

    private String state(ProjectTemplate template, List<TemplateMilestone> items, Long tenantId) {
        try {
            return objectMapper.writeValueAsString(TemplateMilestonePlanResponse.from(template, items, false, tenantId));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to record template milestone changes", exception);
        }
    }
}
