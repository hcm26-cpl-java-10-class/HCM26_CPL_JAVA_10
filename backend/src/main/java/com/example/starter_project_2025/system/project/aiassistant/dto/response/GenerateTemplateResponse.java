package com.example.starter_project_2025.system.project.aiassistant.dto.response;


import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;

import java.time.LocalDateTime;

public record GenerateTemplateResponse(
        Long suggestionId,
        String status,
        GeneratedTemplateOutput output,
        String model,
        LocalDateTime createdAt
) {
}
