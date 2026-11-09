package com.example.starter_project_2025.system.project.template.milestone;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.milestone.dto.response.RubricOptionResponse;
import com.example.starter_project_2025.system.project.rubric.integration.RubricTenantIdentity;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record TemplateMilestonePlanResponse(
        Long templateId,
        Long lockVersion,
        Integer estimatedDurationWeeks,
        boolean editable,
        List<Milestone> milestones
) {
    public static TemplateMilestonePlanResponse from(
            ProjectTemplate template, List<TemplateMilestone> milestones, boolean canUpdate) {
        return from(template, milestones, canUpdate, template.getTenantId());
    }

    /**
     * @param tenantId tenant used to resolve rubric ownership. For shared
     *                 templates ({@code tenant_id is null}) this is the acting
     *                 user's tenant, so an assigned rubric is not hidden.
     */
    public static TemplateMilestonePlanResponse from(
            ProjectTemplate template, List<TemplateMilestone> milestones, boolean canUpdate, Long tenantId) {
        return new TemplateMilestonePlanResponse(template.getId(), template.getLockVersion(), template.getEstimatedDurationWeeks(),
                canUpdate && template.getStatus() == ProjectTemplateStatus.DRAFT,
                milestones.stream().map(milestone -> Milestone.from(milestone, tenantId)).toList());
    }

    public record Milestone(
            Long id,
            String title,
            String description,
            Integer dueAfter,
            TemplateMilestoneTimeUnit dueUnit,
            BigDecimal weight,
            boolean mandatory,
            Integer orderIndex,
            UUID rubricVersionId,
            RubricOptionResponse rubric,
            List<ChecklistItem> checklistItems,
            List<RubricCriterion> legacyRubricCriteria,
            LatePolicy latePolicy
    ) {
        static Milestone from(TemplateMilestone milestone, Long tenantId) {
            var version = milestone.getRubricVersion();
            boolean ownTenant = version != null && tenantId != null
                    && RubricTenantIdentity.from(tenantId).equals(version.getRubric().getTenantId());
            return new Milestone(milestone.getId(), milestone.getTitle(), milestone.getDescription(),
                    milestone.getDueAfter(), milestone.getDueUnit(), milestone.getWeight(), milestone.isMandatory(),
                    milestone.getOrderIndex(), ownTenant ? version.getId() : null,
                    ownTenant ? RubricOptionResponse.from(RubricCatalogService.snapshot(version)) : null,
                    milestone.getChecklistItems().stream().map(ChecklistItem::from).toList(),
                    milestone.getRubricCriteria().stream().map(RubricCriterion::from).toList(),
                    LatePolicy.from(milestone));
        }
    }

    public record ChecklistItem(Long id, String content, boolean mandatory, Integer orderIndex) {
        static ChecklistItem from(TemplateMilestoneChecklistItem item) {
            return new ChecklistItem(item.getId(), item.getContent(), item.isMandatory(), item.getOrderIndex());
        }
    }

    public record RubricCriterion(Long id, String name, String description, BigDecimal maxScore, Integer orderIndex) {
        static RubricCriterion from(TemplateRubricCriterion criterion) {
            return new RubricCriterion(criterion.getId(), criterion.getName(), criterion.getDescription(),
                    criterion.getMaxScore(), criterion.getOrderIndex());
        }
    }

    public record LatePolicy(Boolean allowLateSubmission, Integer maxLateDays, BigDecimal penaltyPerDayPercent) {
        static LatePolicy from(TemplateMilestone milestone) {
            return milestone.getAllowLateSubmission() == null ? null : new LatePolicy(
                    milestone.getAllowLateSubmission(), milestone.getMaxLateDays(), milestone.getPenaltyPerDayPercent());
        }
    }
}
