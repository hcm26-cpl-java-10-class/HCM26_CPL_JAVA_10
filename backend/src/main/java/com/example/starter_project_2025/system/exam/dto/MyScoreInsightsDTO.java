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
        /** Ids of exams the student has submitted whose results are not published yet. */
        List<Long> awaitingExamIds,
        /** Exam id of each score appeal of the student that is still pending (one entry per appeal). */
        List<Long> pendingAppealExamIds,
        /** Points earned / possible per exam and question type over published attempts. */
        List<TypeAccuracy> accuracyByExamType,
        /** Courses the student is enrolled in: enrollment date, lesson progress and the course's exams. */
        List<CourseInfo> courses
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

    public record CourseInfo(
            Long courseId,
            String courseName,
            /** Enrollment date; used by the date filter of My Scores. */
            java.time.LocalDateTime enrolledAt,
            long lessonsTotal,
            long lessonsCompleted,
            /** Ids of the exams linked to this course. */
            List<Long> examIds
    ) {
    }

    public record TypeAccuracy(
            Long examId,
            QuestionType type,
            int questionCount,
            BigDecimal earned,
            BigDecimal possible
    ) {
    }
}
