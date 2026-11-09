package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.question.domain.QuestionType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Extra statistics for the student's "My Scores" page. Only the student's own data plus class averages. */
public record MyScoreInsightsDTO(
        /** Every published attempt of the student (not just the best one per exam). */
        List<AttemptPoint> attempts,
        /** Class average (percent of max score) per exam the student has a published result for. */
        List<ClassAverage> classAverages,
        /** Exams the student has submitted whose results are not published yet. */
        int awaitingPublicationCount,
        /** Score appeals of the student that are still pending. */
        int pendingAppealCount,
        /** Accuracy (earned / possible points) per question type over published attempts. */
        List<TypeAccuracy> accuracyByType
) {
    public record AttemptPoint(
            Long examId,
            String examTitle,
            int attemptNumber,
            BigDecimal finalScore,
            BigDecimal maxScore,
            Boolean passed,
            Instant startedAt,
            Instant submittedAt,
            int durationMinutes,
            /** Seconds between start and submit, capped at the allowed duration. */
            long timeSpentSeconds
    ) {
    }

    public record ClassAverage(
            Long examId,
            /** Average of each participant's best score, in percent of the max score. */
            BigDecimal averagePercent,
            int participants
    ) {
    }

    public record TypeAccuracy(
            QuestionType type,
            int questionCount,
            BigDecimal earned,
            BigDecimal possible,
            BigDecimal accuracyPercent
    ) {
    }
}
