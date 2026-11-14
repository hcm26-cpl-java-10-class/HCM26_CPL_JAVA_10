package com.example.starter_project_2025.system.project.aiassistant.dto;

public record ReviewResourceContext(
        Long resourceId,
        String title,
        String description,
        String kind,
        String url,
        Integer orderIndex
) {
}