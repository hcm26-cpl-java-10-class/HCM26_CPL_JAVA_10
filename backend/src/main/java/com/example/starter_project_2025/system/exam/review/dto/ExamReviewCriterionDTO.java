package com.example.starter_project_2025.system.exam.review.dto;

import java.math.BigDecimal;

/**
 * Mot tieu chi rubric cua cau hoi, kem diem toi da cho reviewer cham.
 */
public record ExamReviewCriterionDTO(
        String criterionName,
        String description,
        int weightPercentage,
        BigDecimal maxPoints
) {
}
