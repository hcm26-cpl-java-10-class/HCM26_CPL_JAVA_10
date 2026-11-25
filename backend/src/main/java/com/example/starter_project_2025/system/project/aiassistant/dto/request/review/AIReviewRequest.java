package com.example.starter_project_2025.system.project.aiassistant.dto.request.review;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AIReviewRequest(
        @NotNull(message = "Snapshot ID is required")
        @Positive(message = "Snapshot ID must be positive")
        Long snapshotId
) {
}