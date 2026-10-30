package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItemRepository;
import com.example.starter_project_2025.system.project.template.milestone.*;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TemplateConfigurationService {
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository snapshots;
    private final TemplateMilestoneRepository milestones;
    private final TemplateBacklogItemRepository backlog;
    private final RubricCatalogService rubrics;
    private final ProjectTemplateValidator validator;
    private final ObjectMapper json;

    public String capture(ProjectTemplate template) {
        var plan = milestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());
        if (!plan.isEmpty()) milestones.findWithRubricCriteria(template.getId());
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("templateId", template.getId());
        content.put("code", template.getCode());
        content.put("name", template.getName());
        content.put("description", template.getDescription());
        content.put("category", template.getCategory());
        content.put("level", template.getLevel());
        content.put("estimatedDurationWeeks", template.getEstimatedDurationWeeks());
        content.put("technologies", template.getTechnologies());
        content.put("targetRoles", template.getTargetRoles());
        content.put("learningOutcomes", template.getLearningOutcomes());
        content.put("constraints", parse(template.getConstraintsJson()));
        content.put("milestones", plan.stream().map(this::milestoneData).toList());
        content.put("backlogItems", backlog.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId()).stream()
                .map(item -> new BacklogData(item.getTitle(), item.getDescription(), item.getSuggestedRole())).toList());
        return write(content);
    }

    public void refreshDraft(ProjectTemplate template) {
        if (template.getStatus() != ProjectTemplateStatus.DRAFT) return;
        snapshots.findByTemplateIdOrderByCreatedAtDesc(template.getId()).stream()
                .filter(version -> version.getProjectId() == null).findFirst()
                .filter(version -> version.getStatus() == ProjectTemplateVersionStatus.DRAFT)
                .ifPresent(version -> version.setContentJson(capture(template)));
    }

    public ProjectTemplate duplicate(ProjectTemplate source, ProjectTemplateSnapshot version, String name, Long tenantId) {
        return duplicate(source, version, name, tenantId, null, 1, null);
    }

    public ProjectTemplate duplicateVersion(ProjectTemplate source, ProjectTemplateSnapshot version,
                                            int nextVersion, Long familyId) {
        return duplicate(source, version, source.getName(), source.getTenantId(),
                source.getCode(), nextVersion, familyId);
    }

    private ProjectTemplate duplicate(ProjectTemplate source, ProjectTemplateSnapshot version, String name, Long tenantId,
                                      String versionCode, int templateVersion, Long familyId) {
        ObjectNode content = parse(version.getContentJson());
        ObjectNode fallback = parse(capture(source));
        fallback.fieldNames().forEachRemaining(field -> {
            if (!content.has(field)) content.set(field, fallback.get(field));
        });
        Configuration configuration;
        try {
            configuration = json.treeToValue(content, Configuration.class);
        } catch (JsonProcessingException exception) {
            throw invalidContent();
        }
        if (configuration.milestones() == null || configuration.backlogItems() == null) throw invalidContent();
        String prefix = source.getCode() == null ? "TPL" : source.getCode();
        prefix = prefix.substring(0, Math.min(prefix.length(), 58));
        String code = versionCode;
        if (code == null) {
            do {
                code = prefix + "-COPY-" + UUID.randomUUID();
            } while (templates.existsByTenantIdAndCodeAndTemplateVersion(tenantId, code, 1));
        }
        validator.validate(new ProjectTemplateRequest(code, name, configuration.description(), configuration.category(),
                configuration.level(), configuration.estimatedDurationWeeks() == null ? null
                        : BigDecimal.valueOf(configuration.estimatedDurationWeeks()), null, source.getCohortId(),
                configuration.technologies(), configuration.targetRoles(), configuration.learningOutcomes()), false);
        var template = templates.saveAndFlush(ProjectTemplate.builder().tenantId(tenantId).code(code).name(name)
                .description(configuration.description()).category(configuration.category()).level(configuration.level())
                .estimatedDurationWeeks(configuration.estimatedDurationWeeks())
                .cohortId(source.getCohortId())
                .technologies(new HashSet<>(configuration.technologies() == null ? Set.of() : configuration.technologies()))
                .targetRoles(new HashSet<>(configuration.targetRoles() == null ? Set.of() : configuration.targetRoles()))
                .learningOutcomes(new HashSet<>(configuration.learningOutcomes() == null ? Set.of() : configuration.learningOutcomes()))
                .constraintsJson(write(configuration.constraints() == null ? Map.of() : configuration.constraints()))
                .status(ProjectTemplateStatus.DRAFT).templateVersion(templateVersion)
                .versionFamilyId(familyId).build());
        for (int index = 0; index < configuration.milestones().size(); index++) {
            copyMilestone(configuration.milestones().get(index), template, index);
        }
        for (int index = 0; index < configuration.backlogItems().size(); index++) {
            BacklogData item = configuration.backlogItems().get(index);
            if (item.title() == null || item.title().isBlank() || item.title().length() > 200) throw invalidContent();
            var copy = new TemplateBacklogItem();
            copy.setTemplate(template);
            copy.setTitle(item.title());
            copy.setDescription(item.description());
            copy.setSuggestedRole(item.suggestedRole());
            copy.setOrderIndex(index);
            backlog.save(copy);
        }
        return template;
    }

    private MilestoneData milestoneData(TemplateMilestone item) {
        var policy = item.getAllowLateSubmission() == null ? null : new LatePolicyData(item.getAllowLateSubmission(),
                item.getMaxLateDays(), item.getPenaltyPerDayPercent());
        return new MilestoneData(item.getTitle(), item.getDescription(), item.getDueAfter(), item.getDueUnit(),
                item.getWeight(), item.isMandatory(), item.getRubricVersion() == null ? null : item.getRubricVersion().getId(),
                item.getChecklistItems().stream().map(check -> new ChecklistData(check.getContent(), check.isMandatory())).toList(),
                item.getRubricCriteria().stream().map(criterion -> new CriterionData(criterion.getName(),
                        criterion.getDescription(), criterion.getMaxScore())).toList(), policy);
    }

    private void copyMilestone(MilestoneData input, ProjectTemplate template, int index) {
        if (input.title() == null || input.title().isBlank() || input.title().length() > 120
                || input.dueAfter() == null || input.dueAfter() <= 0 || input.dueUnit() == null || input.weight() == null) {
            throw invalidContent();
        }
        var copy = new TemplateMilestone();
        copy.setTemplate(template);
        copy.setTitle(input.title());
        copy.setDescription(input.description());
        copy.setDueAfter(input.dueAfter());
        copy.setDueUnit(input.dueUnit());
        copy.setWeight(input.weight());
        copy.setMandatory(input.mandatory() == null || input.mandatory());
        copy.setOrderIndex(index);
        if (input.rubricVersionId() != null) {
            copy.setRubricVersion(rubrics.findPublished(input.rubricVersionId(), template.getTenantId()).orElse(null));
        }
        if (input.latePolicy() != null) {
            copy.setAllowLateSubmission(input.latePolicy().allowLateSubmission());
            copy.setMaxLateDays(input.latePolicy().maxLateDays());
            copy.setPenaltyPerDayPercent(input.latePolicy().penaltyPerDayPercent());
        }
        var checklist = input.checklistItems() == null ? List.<ChecklistData>of() : input.checklistItems();
        for (int order = 0; order < checklist.size(); order++) {
            var item = new TemplateMilestoneChecklistItem();
            item.setMilestone(copy);
            item.setContent(checklist.get(order).content());
            item.setMandatory(checklist.get(order).mandatory());
            item.setOrderIndex(order);
            copy.getChecklistItems().add(item);
        }
        var criteria = input.rubricCriteria() == null ? List.<CriterionData>of() : input.rubricCriteria();
        for (int order = 0; order < criteria.size(); order++) {
            var item = new TemplateRubricCriterion();
            item.setMilestone(copy);
            item.setName(criteria.get(order).name());
            item.setDescription(criteria.get(order).description());
            item.setMaxScore(criteria.get(order).maxScore());
            item.setOrderIndex(order);
            copy.getRubricCriteria().add(item);
        }
        milestones.save(copy);
    }

    private ObjectNode parse(String value) {
        try {
            if (value != null && json.readTree(value) instanceof ObjectNode object) return object;
        } catch (JsonProcessingException exception) {
            throw invalidContent();
        }
        throw invalidContent();
    }

    private String write(Object content) {
        try {
            return json.writeValueAsString(content);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to save template configuration", exception);
        }
    }

    private ProjectTemplateException invalidContent() {
        return new ProjectTemplateException(422, "This version contains invalid template configuration",
                Map.of("contentJson", List.of("Correct the template configuration before duplicating it")));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Configuration(String description, String category, ProjectTemplateLevel level, Integer estimatedDurationWeeks,
                                 Set<String> technologies, Set<String> targetRoles, Set<String> learningOutcomes,
                                 JsonNode constraints, List<MilestoneData> milestones, List<BacklogData> backlogItems) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MilestoneData(String title, String description, Integer dueAfter, TemplateMilestoneTimeUnit dueUnit,
                                 BigDecimal weight, Boolean mandatory, UUID rubricVersionId,
                                 @JsonAlias("checklist") List<ChecklistData> checklistItems,
                                 @JsonAlias("legacyRubricCriteria") List<CriterionData> rubricCriteria,
                                 LatePolicyData latePolicy) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ChecklistData(String content, boolean mandatory) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record CriterionData(String name, String description, BigDecimal maxScore) { }
    private record LatePolicyData(Boolean allowLateSubmission, Integer maxLateDays, BigDecimal penaltyPerDayPercent) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record BacklogData(String title, String description, ProjectMemberRole suggestedRole) { }
}
