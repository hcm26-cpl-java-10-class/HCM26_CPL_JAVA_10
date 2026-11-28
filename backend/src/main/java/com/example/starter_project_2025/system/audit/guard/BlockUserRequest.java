package com.example.starter_project_2025.system.audit.guard;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record BlockUserRequest(
        @Min(1) @Max(365) int days,
        @Size(max = 500) String reason
) {
}
