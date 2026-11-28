package com.example.starter_project_2025.system.exam.review.dto;

import java.math.BigDecimal;

/**
 * Diem theo tieu chi rubric ma reviewer cham cho mot cau hoi.
 */
public record ExamReviewFeedbackItemDTO(
        Long questionId,
        String questionContent,
        String criterionName,
        int weightPercentage,
        BigDecimal maxPoints,
        BigDecimal awardedPoints,
        String comment
) {
}
