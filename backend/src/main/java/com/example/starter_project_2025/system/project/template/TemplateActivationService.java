package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanRequest;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanResponse;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneScheduleValidator;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneValidator;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRubrics;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateActivationService {
    private final ProjectTemplateRepository templates;
    private final TemplateMilestoneRepository milestones;
    private final ProjectTemplateAccessService access;
    private final ProjectTemplateValidator validator;
    private final TemplateMilestoneValidator milestoneValidator;
    private final TemplateMilestoneScheduleValidator scheduleValidator;
    private final TemplateTeamConstraintsMapper teamConstraintsMapper;
    private final ProjectTemplateAuditRepository audits;
    private final ObjectMapper objectMapper;
    private final TemplateMilestoneRubrics rubrics;

    public TemplateActivationChecklist getChecklist(Long id) {
        User user = access.requireUser("READ");
        ProjectTemplate template = findTemplate(id, user);
        return checklist(template, loadMilestones(id), access.can(user, "ACTIVATE"));
    }

    @Transactional
    public ProjectTemplateResponse activate(Long id, TemplateActivationRequest request) {
        User user = access.requireUser("ACTIVATE");
        ProjectTemplate template = findTemplate(id, user);
        if (template.getStatus() != ProjectTemplateStatus.DRAFT) {
            throw ProjectTemplateException.conflict("Only draft templates can be activated");
        }
        requireRevision(request);
        if (!template.getLockVersion().equals(request.lockVersion().longValueExact())) {
            throw ProjectTemplateException.conflict("This template has changed. Reload it before activating");
        }
        List<TemplateMilestone> plan = loadMilestones(id);
        TemplateActivationChecklist checklist = checklist(template, plan, true);
        if (!checklist.ready()) {
            Map<String, List<String>> errors = new LinkedHashMap<>();
            checklist.items().forEach(item -> errors.putAll(item.errors()));
            throw new ProjectTemplateException(422, "Complete the required configuration before activating this template", errors);
        }
        String before = state(template, plan);
        template.setStatus(ProjectTemplateStatus.ACTIVE);
        template = templates.saveAndFlush(template);
        audits.save(new ProjectTemplateAudit(template.getTenantId(), template.getId(), user.getId(),
                "PROJECT_TEMPLATE_ACTIVATED", before, state(template, plan), CorrelationIdFilter.currentId()));
        return ProjectTemplateResponse.from(template, false, teamConstraintsMapper.read(template.getConstraintsJson()));
    }

    private TemplateActivationChecklist checklist(ProjectTemplate template, List<TemplateMilestone> plan, boolean canActivate) {
        var overview = errors(() -> validator.validate(new ProjectTemplateRequest(template.getCode(), template.getName(),
                template.getDescription(), template.getCategory(), template.getLevel(),
                decimal(template.getEstimatedDurationWeeks()), null), false));
        var team = teamErrors(template);
        var input = TemplateMilestonePlanRequest.from(template.getLockVersion(), plan);
        var milestoneErrors = errors(() -> milestoneValidator.validate(input));
        milestoneErrors.putAll(errors(() -> scheduleValidator.validate(input, template.getEstimatedDurationWeeks())));
        if (milestoneErrors.isEmpty()) {
            milestoneErrors.putAll(errors(() -> rubrics.requirePublished(input, template.getTenantId())));
        }
        List<TemplateActivationChecklist.Item> items = List.of(
                item("overview", "General information", overview),
                item("team-constraints", "Team constraints and role quotas", team),
                item("milestones", "Milestones, rubrics and late policies", milestoneErrors));
        boolean draft = template.getStatus() == ProjectTemplateStatus.DRAFT;
        return new TemplateActivationChecklist(template.getId(), template.getLockVersion(), template.getStatus(),
                draft && items.stream().allMatch(TemplateActivationChecklist.Item::passed), draft && canActivate, items);
    }

    private Map<String, List<String>> teamErrors(ProjectTemplate template) {
        TemplateTeamConstraints team;
        try {
            team = teamConstraintsMapper.read(template.getConstraintsJson());
        } catch (IllegalStateException exception) {
            return Map.of("teamConstraints", List.of("Configure valid team constraints before activating this template"));
        }
        if (team == null) {
            return Map.of("teamConstraints", List.of("Configure team size, role quotas and the multi-role setting"));
        }
        return errors(() -> validator.validateTeamConstraints(new TemplateTeamConstraintsRequest(
                decimal(team.minMembers()), decimal(team.maxMembers()), new TemplateTeamConstraintsRequest.RoleQuotas(
                        decimal(team.roleQuotas().pm()), decimal(team.roleQuotas().ba()),
                        decimal(team.roleQuotas().dev()), decimal(team.roleQuotas().qa())), team.allowMultiRole(),
                BigDecimal.valueOf(template.getLockVersion()))));
    }

    private TemplateActivationChecklist.Item item(String section, String label, Map<String, List<String>> errors) {
        return new TemplateActivationChecklist.Item(section, label, errors.isEmpty(), errors);
    }

    private Map<String, List<String>> errors(Runnable validation) {
        try {
            validation.run();
            return new LinkedHashMap<>();
        } catch (ProjectTemplateException exception) {
            return new LinkedHashMap<>(exception.getErrors());
        }
    }

    private void requireRevision(TemplateActivationRequest request) {
        try {
            if (request != null && request.lockVersion() != null && request.lockVersion().longValueExact() >= 0) return;
        } catch (ArithmeticException exception) {
            throw revisionError();
        }
        throw revisionError();
    }

    private ProjectTemplateException revisionError() {
        return new ProjectTemplateException(422, "A valid template revision is required. Please reload the template",
                Map.of("lockVersion", List.of("A valid template revision is required. Please reload the template")));
    }

    private ProjectTemplate findTemplate(Long id, User user) {
        return templates.findByIdAndTenantIdAndIsActiveTrue(id, user.getTenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
    }

    private List<TemplateMilestone> loadMilestones(Long id) {
        List<TemplateMilestone> plan = milestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(id);
        if (!plan.isEmpty()) milestones.findWithRubricCriteria(id);
        return plan;
    }

    private BigDecimal decimal(Integer value) {
        return value == null ? null : BigDecimal.valueOf(value);
    }

    private String state(ProjectTemplate template, List<TemplateMilestone> plan) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "template", ProjectTemplateResponse.from(template, false, teamConstraintsMapper.read(template.getConstraintsJson())),
                    "milestonePlan", TemplateMilestonePlanResponse.from(template, plan, false)));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to record template activation", exception);
        }
    }
}
