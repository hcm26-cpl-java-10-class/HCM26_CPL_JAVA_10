package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal; // NEW
import java.util.List;

public record ExamResultStatisticsDTO(
        Long examId,
        String examTitle,
        long totalAttempts,
        long fullyGradedAttempts,
        long pendingGradingAttempts,
        long uniqueStudents,
        Double averageFinalScore,
        BigDecimal highestFinalScore, // CHANGED: Integer -> BigDecimal
        BigDecimal lowestFinalScore,
        List<ScoreBandDTO> scoreDistribution
) {
    public record ScoreBandDTO(
            String range,
            long count
    ) {
    }
}
