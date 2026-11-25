package com.example.starter_project_2025.system.project.aiassistant.dto.response.output;

public record ModuleOutput(
        String code,
        String name,
        String description,
        String technologyStack,
        String category,
        String level,
        Integer estimatedDurationWeeks
) {
}
