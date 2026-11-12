package com.example.starter_project_2025.system.project.aiassistant.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GenerateTemplateRequest(

        @NotBlank(message = "Project title is required")
        @Size(max = 200, message = "Project title must not exceed 200 characters")
        String projectTitle,

        @NotBlank(message = "Project description is required")
        @Size(max = 5000, message = "Project description must not exceed 5000 characters")
        String projectDescription,

        @NotBlank(message = "Project type is required")
        String projectType,

        @Size(max = 3000, message = "Additional requirements must not exceed 3000 characters")
        String additionalRequirements

) {
}