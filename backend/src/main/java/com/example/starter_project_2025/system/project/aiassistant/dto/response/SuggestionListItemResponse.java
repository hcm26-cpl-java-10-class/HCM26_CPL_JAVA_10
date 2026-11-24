package com.example.starter_project_2025.system.project.aiassistant.dto.response;

import java.time.LocalDateTime;

public record SuggestionListItemResponse(
        Long suggestionId,
        String projectTitle,
        String projectType,
        String status,
        String model,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}