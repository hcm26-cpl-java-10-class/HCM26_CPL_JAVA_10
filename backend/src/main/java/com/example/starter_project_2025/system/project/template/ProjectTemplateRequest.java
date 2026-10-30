package com.example.starter_project_2025.system.project.template;

import java.math.BigDecimal;
import java.util.Set;

public record ProjectTemplateRequest(
        String code,
        String name,
        String description,
        String category,
        ProjectTemplateLevel level,
        BigDecimal estimatedDurationWeeks,
        BigDecimal lockVersion,
        Long cohortId,
        Set<String> technologies,
        Set<String> targetRoles,
        Set<String> learningOutcomes
) {
}
