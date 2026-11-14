package com.example.starter_project_2025.system.project.aiassistant.dto;

import java.math.BigDecimal;
import java.util.List;

public record ReviewRubricCriterionContext(
        String code,
        String name,
        BigDecimal weight,
        BigDecimal maxScore,
        List<ReviewRubricRatingContext> ratings
) {
}