package com.example.starter_project_2025.system.exam.attempt.dto;

import java.math.BigDecimal;
import java.util.List;

/** Read-only learner overview. Never serialize exam entities or question/grading snapshots here. */
public record ExamPreparationDTO(LearnerExamDTO exam, int questionCount, BigDecimal passScore,
        int attemptsUsed, int attemptsRemaining, boolean canStart, boolean canResume, String unavailableReason,
        boolean antiCheatEnabled, boolean requireFullscreen, boolean cameraProctoring,
        List<Attempt> attempts) {
    public record Attempt(ExamAttemptSummaryDTO summary, boolean canReview) {}
}
