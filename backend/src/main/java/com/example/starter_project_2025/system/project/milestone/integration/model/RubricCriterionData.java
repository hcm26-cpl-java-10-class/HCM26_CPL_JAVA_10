package com.example.starter_project_2025.system.project.milestone.integration.model;

import java.math.BigDecimal;
import java.util.List;

public record RubricCriterionData(
        String code,
        String name,
        BigDecimal weight,
        BigDecimal maxScore,
        List<RubricRatingData> ratings
) {
    public RubricCriterionData(String code, String name, BigDecimal weight, BigDecimal maxScore) {
        this(code, name, weight, maxScore, List.of());
    }
}
