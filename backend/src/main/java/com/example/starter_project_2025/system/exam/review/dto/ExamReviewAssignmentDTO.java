package com.example.starter_project_2025.system.exam.review.dto;

import com.example.starter_project_2025.system.exam.review.domain.ExamReviewStatus;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewType;

import java.time.Instant;

/**
 * Thong tin phan cong cham ma nguoi cham (reviewer) nhin thay.
 */
public record ExamReviewAssignmentDTO(
        Long id,
        Long examId,
        String examTitle,
        Long attemptId,
        int attemptNumber,
        ExamReviewType reviewType,
        ExamReviewStatus status,
        /** Nhan hien thi cua tac gia bai lam (da an danh neu exam bat an danh). */
        String authorLabel,
        boolean anonymous,
        Instant assignedAt,
        Instant dueAt,
        Instant submittedAt,
        /** So cau tieu de duoc cham trong bai lam nay. */
        int reviewableQuestionCount
) {
}
