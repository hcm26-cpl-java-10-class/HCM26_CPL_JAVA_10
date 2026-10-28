package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record PublishedExamScoreDTO(
        Long examId,
        String examTitle,
        int attemptNumber,
        BigDecimal objectiveScore,
        BigDecimal finalScore,
        BigDecimal maxScore,
        BigDecimal firstScore,
        BigDecimal secondScore,

        Instant submittedAt
) {
}
