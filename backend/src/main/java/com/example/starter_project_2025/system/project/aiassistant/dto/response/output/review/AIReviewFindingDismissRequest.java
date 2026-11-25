package com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AIReviewFindingDismissRequest(

        @NotBlank(message = "Dismiss reason is required")
        @Size(max = 2000, message = "Dismiss reason must not exceed 2000 characters")
        String reason

) {
}