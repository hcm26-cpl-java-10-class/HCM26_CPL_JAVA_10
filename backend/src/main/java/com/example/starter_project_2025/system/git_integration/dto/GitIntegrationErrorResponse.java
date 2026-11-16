package com.example.starter_project_2025.system.git_integration.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

/**
 * Same shape as the shared ErrorResponse, plus a stable {@code code} the
 * frontend can switch on and optional details for specific codes.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GitIntegrationErrorResponse(
        int status,
        String code,
        String message,
        LocalDateTime timestamp,
        String correlationId,
        Long retryAfterSeconds,
        String installationStatus) {

    public GitIntegrationErrorResponse(int status, String code, String message, LocalDateTime timestamp, String correlationId) {
        this(status, code, message, timestamp, correlationId, null, null);
    }
}
