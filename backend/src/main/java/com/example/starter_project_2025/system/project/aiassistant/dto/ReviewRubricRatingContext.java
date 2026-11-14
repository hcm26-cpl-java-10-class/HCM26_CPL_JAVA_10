package com.example.starter_project_2025.system.project.aiassistant.dto;

import java.math.BigDecimal;

public record ReviewRubricRatingContext(
        String level,
        BigDecimal percentage,
        String description,
        Integer orderIndex
) {
}