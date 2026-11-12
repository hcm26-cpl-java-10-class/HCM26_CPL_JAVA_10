package com.example.starter_project_2025.system.project.aiassistant.dto.response.output;

import java.math.BigDecimal;

public record RubricCriterionOutput(
        String name,
        String description,
        BigDecimal maxScore,
        Integer orderIndex
) {
}
