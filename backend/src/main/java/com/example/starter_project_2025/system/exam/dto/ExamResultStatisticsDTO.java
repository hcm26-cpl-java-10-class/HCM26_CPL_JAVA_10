package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal;
import java.util.List;

public record ExamResultStatisticsDTO(
        Long examId,
        String examTitle,
        long totalAttempts,
        long fullyGradedAttempts,
        long pendingGradingAttempts,
        long uniqueStudents,
        Double averageFinalScore,
        BigDecimal highestFinalScore,
        BigDecimal lowestFinalScore,
        List<ScoreBandDTO> scoreDistribution,
        long passedAttempts,
        Double passRate,
        long failedAttempts,
        Double failRate,
        BigDecimal passScore
) {
    public ExamResultStatisticsDTO(
            Long examId,
            String examTitle,
            long totalAttempts,
            long fullyGradedAttempts,
            long pendingGradingAttempts,
            long uniqueStudents,
            Double averageFinalScore,
            BigDecimal highestFinalScore,
            BigDecimal lowestFinalScore,
            List<ScoreBandDTO> scoreDistribution
    ) {
        this(
                examId,
                examTitle,
                totalAttempts,
                fullyGradedAttempts,
                pendingGradingAttempts,
                uniqueStudents,
                averageFinalScore,
                highestFinalScore,
                lowestFinalScore,
                scoreDistribution,
                0L,
                0.0,
                0L,
                0.0,
                null
        );
    }

    public record ScoreBandDTO(
            String range,
            long count
    ) {
    }
}
