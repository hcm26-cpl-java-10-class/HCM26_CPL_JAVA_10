package com.example.starter_project_2025.system.project.milestone.dto.request;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;

public record LatePolicyRequest(
        @NotNull(message = "Late policy type is required")
        LatePolicyType type,

        Instant lateUntil,

        @DecimalMin(value = "0.00", message = "Late penalty must be at least 0 percent")
        @DecimalMax(value = "100.00", message = "Late penalty must not exceed 100 percent")
        BigDecimal penaltyPercent
) {
}
