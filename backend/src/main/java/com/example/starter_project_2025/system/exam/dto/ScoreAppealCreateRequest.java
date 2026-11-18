package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ScoreAppealCreateRequest(
        @NotBlank(message = "Appeal reason is required")
        @Size(max = 2000, message = "Reason must not exceed 2000 characters")
        String reason,

        @DecimalMin(value = "0", message = "Requested score must be >= 0")
        BigDecimal requestedScore
) {
}
