package com.example.starter_project_2025.system.project.milestone.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record RubricCriterionOptionResponse(
        String code,
        String name,
        BigDecimal weight,
        BigDecimal maxScore,
        List<RubricRatingOptionResponse> ratings
) {
    public RubricCriterionOptionResponse(String code, String name, BigDecimal weight, BigDecimal maxScore) {
        this(code, name, weight, maxScore, List.of());
    }
}
