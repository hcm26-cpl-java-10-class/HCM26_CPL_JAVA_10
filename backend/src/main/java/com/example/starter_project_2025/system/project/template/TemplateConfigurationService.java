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
import com.example.starter_project_2025.system.project.template.artifact.TemplateArtifactRequirementRepository;
import com.example.starter_project_2025.system.project.template.milestone.*;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.function.Function;
import java.util.stream.Collectors;
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
    private final TemplateArtifactRequirementRepository artifactRequirements;
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
        content.put("constraints", parse(template.getConstraintsJson()));
        content.put("milestones", plan.stream().map(this::milestoneData).toList());
        content.put("backlogItems", backlog.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId()).stream()
                .map(item -> new BacklogData(item.getId(), item.getTitle(), item.getDescription(), item.getSuggestedRole())).toList());
        return write(content);
    }

    public void refreshDraft(ProjectTemplate template) {
        if (template.getStatus() != ProjectTemplateStatus.DRAFT) return;
        snapshots.findByTemplateIdOrderByCreatedAtDesc(template.getId()).stream()
                .filter(version -> version.getProjectId() == null && Boolean.TRUE.equals(version.getIsActive())).findFirst()
                .filter(version -> version.getStatus() == ProjectTemplateVersionStatus.DRAFT)
                .ifPresent(version -> version.setContentJson(capture(template)));
    }

    public ObjectNode read(String content) {
        return parse(content).deepCopy();
    }

    public String writeConfiguration(ObjectNode content) {
        return write(content);
    }

    public ProjectTemplate view(ProjectTemplate owner, ProjectTemplateSnapshot version) {
        var content = read(version.getContentJson());
        var configuration = configuration(content);
        return ProjectTemplate.builder().id(owner.getId()).tenantId(owner.getTenantId())
                .code(content.path("code").asText(owner.getCode())).name(content.path("name").asText(owner.getName()))
                .description(configuration.description()).category(configuration.category()).level(configuration.level())
                .estimatedDurationWeeks(configuration.estimatedDurationWeeks()).templateVersion(majorVersion(version.getVersion(), owner.getTemplateVersion()))
                .status(version.getStatus() == ProjectTemplateVersionStatus.DRAFT ? ProjectTemplateStatus.DRAFT
                        : version.getStatus() == ProjectTemplateVersionStatus.ARCHIVED ? ProjectTemplateStatus.ARCHIVED : ProjectTemplateStatus.ACTIVE)
                .constraintsJson(write(configuration.constraints() == null ? Map.of() : configuration.constraints()))
                .lockVersion(owner.getLockVersion()).createdAt(version.getCreatedAt()).updatedAt(version.getUpdatedAt()).build();
    }

    public List<TemplateMilestone> milestoneView(ProjectTemplate template, ObjectNode content) {
        var inputs = configuration(content).milestones();
        if (inputs == null) return List.of();
        List<TemplateMilestone> result = new ArrayList<>();
        for (int index = 0; index < inputs.size(); index++) {
            var item = new TemplateMilestone();
            fillMilestone(item, inputs.get(index), template, index);
            item.setId(inputs.get(index).id());
            for (int order = 0; order < item.getChecklistItems().size(); order++) {
                item.getChecklistItems().get(order).setId(inputs.get(index).checklistItems().get(order).id());
            }
            result.add(item);
        }
        return result;
    }

    public List<TemplateBacklogItem> backlogView(ProjectTemplate template, ObjectNode content) {
        var inputs = configuration(content).backlogItems();
        if (inputs == null) return List.of();
        List<TemplateBacklogItem> result = new ArrayList<>();
        for (int index = 0; index < inputs.size(); index++) {
            var input = inputs.get(index);
            var item = new TemplateBacklogItem();
            item.setId(input.id());
            item.setTemplate(template);
            item.setTitle(input.title());
            item.setDescription(input.description());
            item.setSuggestedRole(input.suggestedRole());
            item.setOrderIndex(index);
            result.add(item);
        }
        return result;
    }

    public void apply(ProjectTemplate template, ObjectNode content) {
        var configuration = configuration(content);
        template.setCode(content.path("code").asText(template.getCode()));
        template.setName(content.path("name").asText(template.getName()));
        template.setDescription(configuration.description());
        template.setCategory(configuration.category());
        template.setLevel(configuration.level());
        template.setEstimatedDurationWeeks(configuration.estimatedDurationWeeks());
        template.setConstraintsJson(write(configuration.constraints() == null ? Map.of() : configuration.constraints()));
        if (configuration.milestones() != null) {
            var existing = milestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId()).stream()
                    .collect(Collectors.toMap(TemplateMilestone::getId, Function.identity()));
            List<TemplateMilestone> updated = new ArrayList<>();
            for (int index = 0; index < configuration.milestones().size(); index++) {
                var input = configuration.milestones().get(index);
                var item = input.id() == null ? null : existing.remove(input.id());
                if (item == null) item = new TemplateMilestone();
                fillMilestone(item, input, template, index);
                updated.add(item);
            }
            if (!existing.isEmpty()) {
                artifactRequirements.deleteByMilestone_IdIn(new ArrayList<>(existing.keySet()));
                milestones.deleteAll(existing.values());
            }
            milestones.saveAllAndFlush(updated);
        }
        if (configuration.backlogItems() != null) {
            var existing = backlog.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId()).stream()
                    .collect(Collectors.toMap(TemplateBacklogItem::getId, Function.identity()));
            List<TemplateBacklogItem> updated = new ArrayList<>();
            for (int index = 0; index < configuration.backlogItems().size(); index++) {
                var input = configuration.backlogItems().get(index);
                var item = input.id() == null ? null : existing.remove(input.id());
                if (item == null) item = new TemplateBacklogItem();
                item.setTemplate(template);
                item.setTitle(input.title());
                item.setDescription(input.description());
                item.setSuggestedRole(input.suggestedRole());
                item.setOrderIndex(index);
                updated.add(item);
            }
            backlog.deleteAll(existing.values());
            backlog.saveAllAndFlush(updated);
        }
    }

    private Configuration configuration(ObjectNode content) {
        try {
            return json.treeToValue(content, Configuration.class);
        } catch (JsonProcessingException exception) {
            throw invalidContent();
        }
    }

    private Integer majorVersion(String label, Integer fallback) {
        if (label == null) return fallback;
        var match = java.util.regex.Pattern.compile("(?i)^v?(\\d+)").matcher(label);
        try { return match.find() ? Integer.valueOf(match.group(1)) : fallback; }
        catch (NumberFormatException exception) { return fallback; }
    }

    public ProjectTemplate duplicate(ProjectTemplate source, ProjectTemplateSnapshot version, String name, Long tenantId) {
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
        String code;
        do {
            code = prefix + "-COPY-" + UUID.randomUUID();
        } while (templates.existsByTenantIdAndCodeAndTemplateVersion(tenantId, code, 1));
        validator.validate(new ProjectTemplateRequest(code, name, configuration.description(), configuration.category(),
                configuration.level(), configuration.estimatedDurationWeeks() == null ? null
                        : BigDecimal.valueOf(configuration.estimatedDurationWeeks()), null), false);
        var template = templates.saveAndFlush(ProjectTemplate.builder().tenantId(tenantId).code(code).name(name)
                .description(configuration.description()).category(configuration.category()).level(configuration.level())
                .estimatedDurationWeeks(configuration.estimatedDurationWeeks())
                .constraintsJson(write(configuration.constraints() == null ? Map.of() : configuration.constraints()))
                .status(ProjectTemplateStatus.DRAFT).templateVersion(1).build());
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
        return new MilestoneData(item.getId(), item.getTitle(), item.getDescription(), item.getDueAfter(), item.getDueUnit(),
                item.getWeight(), item.isMandatory(), item.getRubricVersion() == null ? null : item.getRubricVersion().getId(),
                item.getChecklistItems().stream().map(check -> new ChecklistData(check.getId(), check.getContent(), check.isMandatory())).toList(),
                item.getRubricCriteria().stream().map(criterion -> new CriterionData(criterion.getId(), criterion.getName(),
                        criterion.getDescription(), criterion.getMaxScore())).toList(), policy);
    }

    private void copyMilestone(MilestoneData input, ProjectTemplate template, int index) {
        if (input.title() == null || input.title().isBlank() || input.title().length() > 120
                || input.dueAfter() == null || input.dueAfter() <= 0 || input.dueUnit() == null || input.weight() == null) {
            throw invalidContent();
        }
        var copy = new TemplateMilestone();
        fillMilestone(copy, input, template, index);
        milestones.save(copy);
    }

    private void fillMilestone(TemplateMilestone copy, MilestoneData input, ProjectTemplate template, int index) {
        copy.setTemplate(template);
        copy.setTitle(input.title());
        copy.setDescription(input.description());
        copy.setDueAfter(input.dueAfter());
        copy.setDueUnit(input.dueUnit());
        copy.setWeight(input.weight());
        copy.setMandatory(input.mandatory() == null || input.mandatory());
        copy.setOrderIndex(index);
        copy.setRubricVersion(input.rubricVersionId() == null || template.getTenantId() == null ? null
                : rubrics.findPublished(input.rubricVersionId(), template.getTenantId()).orElse(null));
        copy.setAllowLateSubmission(null);
        copy.setMaxLateDays(null);
        copy.setPenaltyPerDayPercent(null);
        if (input.latePolicy() != null) {
            copy.setAllowLateSubmission(input.latePolicy().allowLateSubmission());
            copy.setMaxLateDays(input.latePolicy().maxLateDays());
            copy.setPenaltyPerDayPercent(input.latePolicy().penaltyPerDayPercent());
        }
        var checklist = input.checklistItems() == null ? List.<ChecklistData>of() : input.checklistItems();
        var existingChecks = copy.getChecklistItems().stream().filter(item -> item.getId() != null)
                .collect(Collectors.toMap(TemplateMilestoneChecklistItem::getId, Function.identity()));
        List<TemplateMilestoneChecklistItem> updatedChecks = new ArrayList<>();
        for (int order = 0; order < checklist.size(); order++) {
            var item = checklist.get(order).id() == null ? null : existingChecks.get(checklist.get(order).id());
            if (item == null) item = new TemplateMilestoneChecklistItem();
            item.setMilestone(copy);
            item.setContent(checklist.get(order).content());
            item.setMandatory(checklist.get(order).mandatory());
            item.setOrderIndex(order);
            updatedChecks.add(item);
        }
        copy.getChecklistItems().removeIf(item -> !updatedChecks.contains(item));
        updatedChecks.forEach(item -> { if (!copy.getChecklistItems().contains(item)) copy.getChecklistItems().add(item); });
        copy.getChecklistItems().sort(java.util.Comparator.comparing(TemplateMilestoneChecklistItem::getOrderIndex));
        var criteria = input.rubricCriteria() == null ? List.<CriterionData>of() : input.rubricCriteria();
        var existingCriteria = copy.getRubricCriteria().stream().filter(item -> item.getId() != null)
                .collect(Collectors.toMap(TemplateRubricCriterion::getId, Function.identity()));
        List<TemplateRubricCriterion> updatedCriteria = new ArrayList<>();
        for (int order = 0; order < criteria.size(); order++) {
            var item = criteria.get(order).id() == null ? null : existingCriteria.get(criteria.get(order).id());
            if (item == null) item = new TemplateRubricCriterion();
            item.setMilestone(copy);
            item.setName(criteria.get(order).name());
            item.setDescription(criteria.get(order).description());
            item.setMaxScore(criteria.get(order).maxScore());
            item.setOrderIndex(order);
            updatedCriteria.add(item);
        }
        copy.getRubricCriteria().removeIf(item -> !updatedCriteria.contains(item));
        updatedCriteria.forEach(item -> { if (!copy.getRubricCriteria().contains(item)) copy.getRubricCriteria().add(item); });
        copy.getRubricCriteria().sort(java.util.Comparator.comparing(TemplateRubricCriterion::getOrderIndex));
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
                                 JsonNode constraints, List<MilestoneData> milestones, List<BacklogData> backlogItems) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record MilestoneData(Long id, String title, String description, Integer dueAfter, TemplateMilestoneTimeUnit dueUnit,
                                 BigDecimal weight, Boolean mandatory, UUID rubricVersionId,
                                 @JsonAlias("checklist") List<ChecklistData> checklistItems,
                                 @JsonAlias("legacyRubricCriteria") List<CriterionData> rubricCriteria,
                                 LatePolicyData latePolicy) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ChecklistData(Long id, String content, boolean mandatory) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record CriterionData(Long id, String name, String description, BigDecimal maxScore) { }
    private record LatePolicyData(Boolean allowLateSubmission, Integer maxLateDays, BigDecimal penaltyPerDayPercent) { }
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record BacklogData(Long id, String title, String description, ProjectMemberRole suggestedRole) { }
}
