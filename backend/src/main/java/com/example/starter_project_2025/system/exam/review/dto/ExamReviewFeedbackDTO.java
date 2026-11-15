package com.example.starter_project_2025.system.exam.review.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Feedback nhan duoc tu reviewer (author view).
 *
 * <p>Khong bao gio chua ten reviewer khi exam bat an danh.
 */
public record ExamReviewFeedbackDTO(
        Long submissionId,
        Long assignmentId,
        Long examId,
        String examTitle,
        Long attemptId,
        int attemptNumber,
        /** Ten reviewer (da an danh neu exam bat an danh). */
        String reviewerLabel,
        boolean anonymous,
        boolean selfReview,
        BigDecimal overallScore,
        BigDecimal maxOverallScore,
        String overallComment,
        java.time.Instant submittedAt,
        List<ExamReviewFeedbackItemDTO> items
) {
}
