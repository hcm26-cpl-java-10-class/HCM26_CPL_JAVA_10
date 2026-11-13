package com.example.starter_project_2025.system.project.aiassistant.dto.response;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;
import java.time.LocalDateTime;

public record SuggestionDetailResponse(
        Long suggestionId,
        String projectTitle,
        String projectDescription,
        String projectType,
        String additionalRequirements,
        String status,
        GeneratedTemplateOutput output,
        String model,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}