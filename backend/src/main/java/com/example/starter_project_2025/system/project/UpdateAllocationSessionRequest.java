package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.Positive;

public record UpdateAllocationSessionRequest(
        @Positive(message = "maxMembers must be greater than zero")
        Integer maxMembers
) {
}
