package com.example.starter_project_2025.system.project.aiassistant.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejectSuggestionRequest(

        @NotBlank(message = "Rejection reason is required")
        @Size(max = 2000, message = "Rejection reason must not exceed 2000 characters")
        String reason

) {}