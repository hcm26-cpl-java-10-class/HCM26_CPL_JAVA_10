package com.example.starter_project_2025.system.project.milestone.integration.model;

import java.math.BigDecimal;

public record RubricCriterionData(
        String code,
        String name,
        BigDecimal weight,
        BigDecimal maxScore
) {
}
