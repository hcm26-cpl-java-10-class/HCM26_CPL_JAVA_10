package com.example.starter_project_2025.system.exam.review.dto;

/**
 * Kết quả phân công reviewer cho 1 đề thi (teacher view).
 */
public record ExamReviewAssignResultDTO(
        Long examId,
        boolean selfReviewEnabled,
        boolean peerReviewEnabled,
        int peerReviewCount,
        int eligibleAttemptCount,
        int assignedCount,
        int submittedCount,
        int pendingCount,
        /** Số attempt chưa đủ reviewer (thiếu người thi để chấm chéo). */
        int underAssignedAttemptCount
) {
}
