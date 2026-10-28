package com.example.starter_project_2025.system.project.template.assignment;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.template.artifact.TemplateArtifactRequirement;
import com.example.starter_project_2025.system.project.template.artifact.TemplateArtifactRequirementRepository;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItemRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneChecklistItem;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateRubricCriterion;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-13 step 1 — "chụp snapshot đề bài".
 * <p>
 * When a mentor/admin assigns a brief to a team (and therefore activates the
 * workspace creation flow), the currently published version of the
 * {@link ProjectTemplate} is copied into a brand new
 * {@link ProjectTemplateSnapshot} row. The copy contains the whole brief:
 * context, goals, constraints, milestones with rubric/checklist and late
 * policy, backlog items and artifact requirements.
 * <p>
 * The row is stored as {@link ProjectTemplateVersionStatus#PUBLISHED} so it can
 * never be edited again (only {@code DRAFT} versions are editable) and with
 * {@code isActive = false} so it never shadows the template's own active
 * version when the next version is published.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TemplateBriefSnapshotWriter {

    /** Marker written into {@code content_json} so assignment copies are identifiable. */
    public static final String PURPOSE_TEAM_ASSIGNMENT = "TEAM_ASSIGNMENT";

    private static final int MAX_VERSION_LENGTH = 50;

    private final ProjectTemplateSnapshotRepository snapshots;
    private final TemplateMilestoneRepository templateMilestones;
    private final TemplateBacklogItemRepository templateBacklogItems;
    private final TemplateArtifactRequirementRepository templateArtifacts;
    private final ObjectMapper objectMapper;

    /**
     * Copies the active version of {@code template} (or the template itself when
     * no version exists yet) into a fresh, immutable assignment snapshot.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public ProjectTemplateSnapshot snapshotForAssignment(ProjectTemplate template, Long teamId) {

        ProjectTemplateSnapshot source = resolveActiveVersion(template.getId());

        ProjectTemplateSnapshot snapshot = ProjectTemplateSnapshot.builder()
                .templateId(template.getId())
                .projectId(null)
                .parentTemplateId(source == null ? null : source.getId())
                .version(assignmentVersion(template.getId(), teamId, source))
                .status(ProjectTemplateVersionStatus.PUBLISHED)
                .contentJson(contentJson(template, source, teamId))
                .isActive(false)
                .build();

        ProjectTemplateSnapshot saved = snapshots.saveAndFlush(snapshot);

        log.info("US-13 brief snapshot {} (template {}, team {}, source version {}) created",
                saved.getId(), template.getId(), teamId, source == null ? "-" : source.getVersion());

        return saved;
    }

    /** Links the snapshot to the silently created project (evidence row). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void linkProject(ProjectTemplateSnapshot snapshot, Long projectId) {

        snapshot.setProjectId(projectId);
        snapshots.saveAndFlush(snapshot);
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private ProjectTemplateSnapshot resolveActiveVersion(Long templateId) {

        return snapshots
                .findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDesc(
                        templateId, ProjectTemplateVersionStatus.PUBLISHED)
                .or(() -> snapshots.findFirstByTemplateIdAndIsActiveTrueOrderByCreatedAtDesc(templateId))
                .orElse(null);
    }

    /**
     * Version label of the assignment copy: {@code <sourceVersion>-T<teamId>},
     * suffixed with {@code -R2}, {@code -R3}, ... when the same team receives the
     * same brief version twice (A-&gt;A reassignment).
     */
    private String assignmentVersion(Long templateId, Long teamId, ProjectTemplateSnapshot source) {

        String base = source == null || source.getVersion() == null || source.getVersion().isBlank()
                ? "v1.0"
                : source.getVersion().trim();
        String label = truncate(base + "-T" + teamId, MAX_VERSION_LENGTH);

        int attempt = 1;
        while (snapshots.existsByTemplateIdAndVersion(templateId, label)) {
            attempt++;
            label = truncate(base + "-T" + teamId + "-R" + attempt, MAX_VERSION_LENGTH);
        }
        return label;
    }

    private String contentJson(ProjectTemplate template, ProjectTemplateSnapshot source, Long teamId) {

        List<TemplateMilestone> milestones =
                templateMilestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());
        List<TemplateBacklogItem> backlog =
                templateBacklogItems.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());
        List<TemplateArtifactRequirement> artifacts =
                templateArtifacts.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());

        Map<String, Object> content = new LinkedHashMap<>();
        content.put("purpose", PURPOSE_TEAM_ASSIGNMENT);
        content.put("assignedTeamId", teamId);
        content.put("templateId", template.getId());
        content.put("code", template.getCode());
        content.put("name", template.getName());
        content.put("context", template.getDescription());
        content.put("category", template.getCategory());
        content.put("level", template.getLevel() == null ? null : template.getLevel().name());
        content.put("estimatedDurationWeeks", template.getEstimatedDurationWeeks());
        content.put("sourceSnapshotId", source == null ? null : source.getId());
        content.put("sourceVersion", source == null ? null : source.getVersion());
        content.put("constraints", readJsonOrNull(template.getConstraintsJson()));
        content.put("goals", milestones.stream().map(TemplateMilestone::getTitle).toList());
        content.put("deliverables", deliverables(milestones, artifacts));
        content.put("milestones", milestones.stream().map(this::milestone).toList());
        content.put("backlogItems", backlog.stream().map(this::backlogItem).toList());
        content.put("artifacts", artifacts.stream().map(this::artifact).toList());

        try {
            return objectMapper.writeValueAsString(content);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize the project brief snapshot", exception);
        }
    }

    private List<String> deliverables(List<TemplateMilestone> milestones,
                                      List<TemplateArtifactRequirement> artifacts) {

        List<String> rows = new ArrayList<>();
        artifacts.stream().map(TemplateArtifactRequirement::getTitle)
                .filter(title -> title != null && !title.isBlank())
                .forEach(rows::add);
        milestones.stream().map(TemplateMilestone::getTitle)
                .filter(title -> title != null && !title.isBlank() && !rows.contains(title))
                .forEach(rows::add);
        return rows;
    }

    private Map<String, Object> milestone(TemplateMilestone milestone) {

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", milestone.getId());
        row.put("title", milestone.getTitle());
        row.put("description", milestone.getDescription());
        row.put("dueAfter", milestone.getDueAfter());
        row.put("dueUnit", milestone.getDueUnit() == null ? null : milestone.getDueUnit().name());
        row.put("weight", milestone.getWeight());
        row.put("mandatory", milestone.isMandatory());
        row.put("rubricVersionId", milestone.getRubricVersion() == null
                ? null
                : milestone.getRubricVersion().getId());
        Map<String, Object> latePolicy = new LinkedHashMap<>();
        latePolicy.put("allowLateSubmission", milestone.getAllowLateSubmission());
        latePolicy.put("maxLateDays", milestone.getMaxLateDays());
        latePolicy.put("penaltyPerDayPercent", milestone.getPenaltyPerDayPercent());
        row.put("latePolicy", latePolicy);
        row.put("checklist", milestone.getChecklistItems().stream().map(this::checklistItem).toList());
        row.put("rubricCriteria", milestone.getRubricCriteria().stream().map(this::rubricCriterion).toList());
        return row;
    }

    private Map<String, Object> checklistItem(TemplateMilestoneChecklistItem item) {

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("content", item.getContent());
        row.put("mandatory", item.isMandatory());
        row.put("orderIndex", item.getOrderIndex());
        return row;
    }

    private Map<String, Object> rubricCriterion(TemplateRubricCriterion criterion) {

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", criterion.getName());
        row.put("description", criterion.getDescription());
        row.put("maxScore", criterion.getMaxScore());
        row.put("orderIndex", criterion.getOrderIndex());
        return row;
    }

    private Map<String, Object> backlogItem(TemplateBacklogItem item) {

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("title", item.getTitle());
        row.put("description", item.getDescription());
        row.put("suggestedRole", item.getSuggestedRole() == null ? null : item.getSuggestedRole().name());
        row.put("orderIndex", item.getOrderIndex());
        return row;
    }

    private Map<String, Object> artifact(TemplateArtifactRequirement requirement) {

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("milestoneTitle", requirement.getMilestone() == null
                ? null
                : requirement.getMilestone().getTitle());
        row.put("title", requirement.getTitle());
        row.put("description", requirement.getDescription());
        row.put("type", requirement.getType() == null ? null : requirement.getType().name());
        row.put("allowedMimeTypes", List.copyOf(requirement.getAllowedMimeTypes()));
        row.put("orderIndex", requirement.getOrderIndex());
        return row;
    }

    private Object readJsonOrNull(String json) {

        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private static String truncate(String value, int max) {

        return value.length() <= max ? value : value.substring(0, max);
    }
}
