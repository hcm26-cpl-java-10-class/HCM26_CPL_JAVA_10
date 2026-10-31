package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ScoreAppealStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ScoreAppealDTO(
        Long id,
        Long examId,
        String examTitle,
        Long attemptId,
        int attemptNumber,
        Long studentId,
        String studentName,
        String reason,
        BigDecimal requestedScore,
        ScoreAppealStatus status,
        BigDecimal oldScore,
        BigDecimal newScore,
        Long reviewerId,
        String reviewerName,
        LocalDateTime reviewedAt,
        String resolutionNote,
        boolean adjustmentApplied,
        LocalDateTime createdAt
) {
}
