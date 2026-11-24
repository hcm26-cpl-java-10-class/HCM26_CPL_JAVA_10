package com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review;

public record AIReviewFindingDetail(
        Long findingId,
        String category,
        String severity,
        String status,
        String title,
        String description,
        String recommendation,
        String targetType,
        String targetId
) {}