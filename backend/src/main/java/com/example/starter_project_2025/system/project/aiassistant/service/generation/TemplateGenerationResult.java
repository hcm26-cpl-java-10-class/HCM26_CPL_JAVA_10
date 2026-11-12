package com.example.starter_project_2025.system.project.aiassistant.service.generation;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;
public record TemplateGenerationResult(
        GeneratedTemplateOutput output,
        String generatedContent,
        String model
) {
}