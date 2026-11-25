package com.example.starter_project_2025.system.project.aiassistant.dto.response.output;

public record BacklogItemOutput(
        String title,
        String description,
        String suggestedRole,
        Integer orderIndex
) {
}
