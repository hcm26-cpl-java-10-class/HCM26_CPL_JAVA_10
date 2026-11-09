package com.example.starter_project_2025.system.project.milestone.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ChecklistItemRequest(
        @NotBlank(message = "Checklist content is required")
        @Size(max = 500, message = "Checklist content must not exceed 500 characters")
        String content,

        boolean mandatory,

        @NotNull(message = "Checklist order is required")
        @Min(value = 0, message = "Checklist order must not be negative")
        Integer orderIndex
) {
}
