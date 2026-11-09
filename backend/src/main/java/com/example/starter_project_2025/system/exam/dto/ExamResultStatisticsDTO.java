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
        /** Diem dat hien tai cua de (null neu khong dat diem dat). */
        BigDecimal passScore,
        /** So luot da cham xong va dat. */
        long passedAttempts,
        /** Ti le dat (%) tren cac luot da cham xong co diem dat; null neu khong tinh duoc. */
        Double passRate
) {
    public record ScoreBandDTO(
            String range,
            long count
    ) {
    }
}
