package com.example.starter_project_2025.system.project.milestone.exception;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record MilestoneErrorResponse(
        int status,
        String code,
        String message,
        Map<String, List<String>> errors,
        String correlationId,
        Instant timestamp
) {
}
