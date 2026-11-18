package com.example.starter_project_2025.system.project.template;

import java.math.BigDecimal;

public record ProjectTemplateRequest(
        String code,
        String name,
        String description,
        String category,
        String level,
        BigDecimal estimatedDurationWeeks,
        BigDecimal lockVersion,
        Long parentTemplateId,
        String technologyStack
) {
    public ProjectTemplateRequest(String code, String name, String description, String category,
            String level, BigDecimal estimatedDurationWeeks, BigDecimal lockVersion) {
        this(code, name, description, category, level, estimatedDurationWeeks, lockVersion, null, null);
    }
    public ProjectTemplateRequest withCategory(String inheritedCategory) {
        return new ProjectTemplateRequest(code, name, description, inheritedCategory, level,
                estimatedDurationWeeks, lockVersion, parentTemplateId, technologyStack);
    }
}
