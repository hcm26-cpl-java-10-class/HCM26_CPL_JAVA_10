package com.example.starter_project_2025.system.project.aiassistant.dto.response.output;

import java.math.BigDecimal;
import java.util.List;

public record MilestoneOutput(
        String title,
        String description,
        Integer dueAfter,
        String dueUnit,
        BigDecimal weight,
        boolean mandatory,
        Integer orderIndex,
        Boolean allowLateSubmission,
        Integer maxLateDays,
        BigDecimal penaltyPerDayPercent,
        List<ChecklistItemOutput> checklistItems,
        List<RubricCriterionOutput> rubricCriteria
) {
}

