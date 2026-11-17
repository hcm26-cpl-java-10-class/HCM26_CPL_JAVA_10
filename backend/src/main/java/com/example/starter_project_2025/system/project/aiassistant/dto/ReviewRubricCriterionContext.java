package com.example.starter_project_2025.system.project.aiassistant.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ReviewRubricCriterionContext(
        UUID id,
        String code,
        String name,
        BigDecimal weight,
        BigDecimal maxScore,
        List<ReviewRubricRatingContext> ratings
) {
}