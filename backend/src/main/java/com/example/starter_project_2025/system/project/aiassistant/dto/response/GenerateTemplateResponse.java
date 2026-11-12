package com.example.starter_project_2025.system.project.aiassistant.dto.response;

import java.time.LocalDateTime;

public record GenerateTemplateResponse(

        Long suggestionId,

        String status,

        String generatedContent,

        String model,

        LocalDateTime createdAt

) {
}