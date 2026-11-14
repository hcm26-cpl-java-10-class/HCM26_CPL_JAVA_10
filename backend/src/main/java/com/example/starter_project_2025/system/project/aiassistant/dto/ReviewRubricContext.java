package com.example.starter_project_2025.system.project.aiassistant.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ReviewRubricContext(
        UUID rubricVersionId,
        String name,
        String description,
        String version,
        String status,
        BigDecimal totalMaxScore,
        List<ReviewRubricCriterionContext> criteria
) {
}