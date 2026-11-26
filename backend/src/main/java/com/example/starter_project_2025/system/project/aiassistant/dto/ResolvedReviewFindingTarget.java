package com.example.starter_project_2025.system.project.aiassistant.dto;

import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory;

public record ResolvedReviewFindingTarget(
        AIReviewFindingCategory category,
        String targetType,
        String targetId,
        Long templateId,
        Long snapshotId,
        Object target
) {
}