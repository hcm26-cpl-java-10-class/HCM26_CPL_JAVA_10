package com.example.starter_project_2025.system.git_integration.dto;

import java.time.LocalDateTime;

/** Same shape as the shared ErrorResponse, plus a stable {@code code} the frontend can switch on. */
public record GitIntegrationErrorResponse(
        int status,
        String code,
        String message,
        LocalDateTime timestamp,
        String correlationId) {
}
