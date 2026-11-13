package com.example.starter_project_2025.system.project.aiassistant.dto.response.output;

import java.math.BigDecimal;
import java.util.List;

public record RubricCriterionOutput(
        String code,
        String name,
        String description,
        BigDecimal weight,
        BigDecimal maxScore,
        Integer orderIndex,
        List<RubricRatingOutput> ratings
) {}