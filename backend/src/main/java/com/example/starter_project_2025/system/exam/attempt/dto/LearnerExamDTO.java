package com.example.starter_project_2025.system.exam.attempt.dto;

import com.example.starter_project_2025.system.exam.core.domain.*;
import com.example.starter_project_2025.system.exam.grading.service.ExamScoring;
import java.math.BigDecimal;

/** Allowlist for learner catalog metadata: no questions, access code, or management information. */
public record LearnerExamDTO(Long id, String title, int durationMinutes, ExamCategory category,
        BigDecimal maxScore, Integer maxAttempts, boolean hasPassword, Long courseId, String courseName,
        String sectionTitle, String lessonTitle, Boolean showAnswersAfterExam, ResultVisibility resultVisibility) {
    public static LearnerExamDTO from(Exam e) {
        return new LearnerExamDTO(e.getId(), e.getTitle(), e.getDurationMinutes(), e.getCategory(),
                ExamScoring.effectiveMax(e.getMaxScore()), e.getMaxAttempts(),
                e.getAccessCode() != null && !e.getAccessCode().isBlank(),
                e.getCourse() == null ? null : e.getCourse().getId(),
                e.getCourse() == null ? null : e.getCourse().getName(),
                e.getSection() == null ? null : e.getSection().getTitle(),
                e.getLesson() == null ? null : e.getLesson().getTitle(),
                e.getShowAnswersAfterExam(), e.getResultVisibility());
    }
}
