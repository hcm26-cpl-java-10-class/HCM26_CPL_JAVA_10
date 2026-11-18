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
        BigDecimal passScore,
        List<GradeDistributionDTO> gradeDistribution
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
            List<ScoreBandDTO> scoreDistribution,
            long passedAttempts,
            Double passRate,
            long failedAttempts,
            Double failRate,
            BigDecimal passScore
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
                passedAttempts,
                passRate,
                failedAttempts,
                failRate,
                passScore,
                List.of()
        );
    }

    public record ScoreBandDTO(
            String range,
            long count
    ) {
    }

    public record GradeDistributionDTO(
            String gradeLetter,
            String label,
            BigDecimal minScore,
            BigDecimal maxScore,
            String color,
            long count,
            Double percentage
    ) {
    }
}
