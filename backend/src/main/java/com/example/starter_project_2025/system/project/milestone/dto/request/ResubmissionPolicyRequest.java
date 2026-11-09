package com.example.starter_project_2025.system.project.milestone.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record ResubmissionPolicyRequest(
        boolean allowed,
        @Min(value = 1, message = "Maximum submission attempts must be at least 1")
        @Max(value = 100, message = "Maximum submission attempts must not exceed 100")
        Integer maxAttempts
) {
}
