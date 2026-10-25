package com.example.starter_project_2025.exception.error;

import com.example.starter_project_2025.web.CorrelationIdFilter;

import java.time.LocalDateTime;

public record ErrorResponse(int status, String message, LocalDateTime timestamp, String correlationId) {
    public ErrorResponse(int status, String message, LocalDateTime timestamp) {
        this(status, message, timestamp, CorrelationIdFilter.currentId());
    }
}
