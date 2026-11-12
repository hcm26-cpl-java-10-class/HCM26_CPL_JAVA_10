package com.example.starter_project_2025.system.project.aiassistant.dto.response.output;

public record ChecklistItemOutput(
        String content,
        boolean mandatory,
        Integer orderIndex
) {
}
