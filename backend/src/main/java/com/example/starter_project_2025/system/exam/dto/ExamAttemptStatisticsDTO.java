package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import java.math.BigDecimal;
import java.time.Instant;

public record ExamAttemptStatisticsDTO(
        Long attemptId,
        Long studentId,
        String studentName,
        String studentEmail,
        Integer attemptNumber,
        Instant startedAt,
        Instant submittedAt,
        BigDecimal finalScore,
        ExamAttemptStatus status,
        BigDecimal maxScore,
        BigDecimal firstScore,
        BigDecimal secondScore,
        boolean flagged,
        long violationCount,
        boolean editable,
        String lockReason,
        Boolean passed
) {
    public ExamAttemptStatisticsDTO(
            Long attemptId,
            Long studentId,
            String studentName,
            String studentEmail,
            Integer attemptNumber,
            Instant startedAt,
            Instant submittedAt,
            BigDecimal finalScore,
            ExamAttemptStatus status,
            BigDecimal maxScore,
            BigDecimal firstScore,
            BigDecimal secondScore,
            boolean flagged,
            long violationCount,
            boolean editable,
            String lockReason
    ) {
        this(
                attemptId,
                studentId,
                studentName,
                studentEmail,
                attemptNumber,
                startedAt,
                submittedAt,
                finalScore,
                status,
                maxScore,
                firstScore,
                secondScore,
                flagged,
                violationCount,
                editable,
                lockReason,
                null
        );
    }
}
