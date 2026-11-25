package com.example.starter_project_2025.system.exam.integrity.dto;

import com.example.starter_project_2025.system.exam.integrity.domain.IntegrityReviewStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record IntegrityReviewRequest(
        @NotNull(message = "Review status is required")
        IntegrityReviewStatus status,

        @Size(max = 1000, message = "Review note must not exceed 1000 characters")
        String note
) {}
