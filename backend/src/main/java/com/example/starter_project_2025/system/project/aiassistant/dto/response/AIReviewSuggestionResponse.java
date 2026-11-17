package com.example.starter_project_2025.system.project.aiassistant.dto.response;

import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.List;

public record AIReviewSuggestionResponse(
        Long suggestionId,
        Long findingId,
        Long templateId,
        Long sourceSnapshotId,
        String targetType,
        String targetId,
        String rationale,
        JsonNode changes,
        SuggestionStatus status,
        List<String> validationErrors,
        String rejectionReason,
        Long appliedSnapshotId,
        Long createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
