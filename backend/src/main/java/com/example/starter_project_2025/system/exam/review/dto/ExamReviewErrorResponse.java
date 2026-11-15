package com.example.starter_project_2025.system.exam.review.dto;

import java.time.Instant;

/**
 * Error response chuan cho workflow tu danh gia / danh gia cheo.
 */
public record ExamReviewErrorResponse(
        int status,
        String code,
        String message,
        java.util.Map<String, java.util.List<String>> errors,
        String correlationId,
        Instant timestamp
) {
}
