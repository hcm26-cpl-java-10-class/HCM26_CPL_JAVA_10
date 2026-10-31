package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ScoreAppealReviewRequest(
        @NotNull(message = "Review decision is required")
        ScoreAppealDecision decision,

        @DecimalMin(value = "0", message = "New score must be >= 0")
        BigDecimal newScore,

        @Size(max = 2000, message = "Resolution note must not exceed 2000 characters")
        String resolutionNote
) {
}
