package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal; // NEW
import java.time.Instant;

public record PublishedExamScoreDTO(
        Long examId,
        String examTitle,
        int attemptNumber,
        BigDecimal objectiveScore, // CHANGED: Integer -> BigDecimal
        BigDecimal finalScore,
        BigDecimal maxScore, // CHANGED: trước đây là totalPoints (tổng điểm cứng); giờ là thang điểm của đề

        Instant submittedAt
) {
}
