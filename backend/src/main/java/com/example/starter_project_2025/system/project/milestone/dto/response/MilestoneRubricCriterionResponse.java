package com.example.starter_project_2025.system.project.milestone.dto.response;

import java.math.BigDecimal;

public record MilestoneRubricCriterionResponse(
        String code,
        String name,
        BigDecimal weight,
        BigDecimal maxScore
) {
}
