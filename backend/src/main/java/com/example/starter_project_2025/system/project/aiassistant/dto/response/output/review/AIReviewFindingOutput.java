package com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review;

public record AIReviewFindingOutput(
        String category,
        String severity,
        String title,
        String description,
        String recommendation,
        String targetType,
        String targetId
) {
}