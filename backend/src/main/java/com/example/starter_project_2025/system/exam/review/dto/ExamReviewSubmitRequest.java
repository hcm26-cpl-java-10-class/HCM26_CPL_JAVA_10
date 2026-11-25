package com.example.starter_project_2025.system.exam.review.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Request nop phieu cham (tu danh gia / danh gia cheo).
 */
public record ExamReviewSubmitRequest(
        BigDecimal overallScore,
        String overallComment,
        List<Item> items
) {

    /**
     * Diem cho mot tieu chi rubric cua mot cau hoi.
     */
    public record Item(
            Long questionId,
            String criterionName,
            BigDecimal awardedPoints,
            String comment
    ) {
    }
}
