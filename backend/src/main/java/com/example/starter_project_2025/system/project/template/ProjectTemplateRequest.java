package com.example.starter_project_2025.system.project.template;

import java.math.BigDecimal;

public record ProjectTemplateRequest(
        String code,
        String name,
        String description,
        String category,
        ProjectTemplateLevel level,
        BigDecimal estimatedDurationWeeks,
        BigDecimal lockVersion
) {
}
