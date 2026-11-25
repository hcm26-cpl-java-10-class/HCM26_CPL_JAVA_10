package com.example.starter_project_2025.system.project.aiassistant.dto.request.review;

import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingSeverity;

public record ReviewFindingInput(
        AIReviewFindingCategory category,
        AIReviewFindingSeverity severity,
        String title,
        String description,
        String recommendation,
        String targetType,
        String targetId
) {
}
