package com.example.starter_project_2025.system.project.template.milestone;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record TemplateMilestonePlanRequest(
        BigDecimal lockVersion,
        List<Milestone> milestones
) {
    public static TemplateMilestonePlanRequest from(Long lockVersion, List<TemplateMilestone> milestones) {
        return new TemplateMilestonePlanRequest(BigDecimal.valueOf(lockVersion), milestones.stream().map(item ->
                new Milestone(BigDecimal.valueOf(item.getId()), item.getTitle(), item.getDescription(),
                        decimal(item.getDueAfter()), item.getDueUnit(), item.getWeight(), item.isMandatory(),
                        item.getRubricVersion() == null ? null : item.getRubricVersion().getId(),
                        item.getChecklistItems().stream().map(check -> new ChecklistItem(
                                BigDecimal.valueOf(check.getId()), check.getContent(), check.isMandatory())).toList(),
                        item.getAllowLateSubmission() == null ? null : new LatePolicy(item.getAllowLateSubmission(),
                                decimal(item.getMaxLateDays()), item.getPenaltyPerDayPercent()))).toList());
    }

    private static BigDecimal decimal(Integer value) {
        return value == null ? null : BigDecimal.valueOf(value);
    }

    public record Milestone(
            BigDecimal id,
            String title,
            String description,
            BigDecimal dueAfter,
            TemplateMilestoneTimeUnit dueUnit,
            BigDecimal weight,
            Boolean mandatory,
            UUID rubricVersionId,
            List<ChecklistItem> checklistItems,
            LatePolicy latePolicy
    ) {
        Long savedId() {
            return id == null ? null : id.longValueExact();
        }
    }

    public record ChecklistItem(BigDecimal id, String content, Boolean mandatory) {
        Long savedId() {
            return id == null ? null : id.longValueExact();
        }
    }

    public record LatePolicy(Boolean allowLateSubmission, BigDecimal maxLateDays, BigDecimal penaltyPerDayPercent) {
    }
}
