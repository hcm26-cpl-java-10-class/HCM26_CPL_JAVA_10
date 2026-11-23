package com.example.starter_project_2025.system.exam.review.dto;

import com.example.starter_project_2025.system.exam.review.domain.ExamReviewStatus;

import java.math.BigDecimal;
import java.util.List;

/**
 * Chi tiet bai lam duoc cham (reviewer view).
 *
 * <p>Khong bao gio chua ten/email cua tac gia khi exam bat an danh; thay bang {@code authorLabel}.
 */
public record ExamReviewTargetDTO(
        Long assignmentId,
        Long examId,
        String examTitle,
        Long attemptId,
        int attemptNumber,
        String authorLabel,
        boolean anonymous,
        ExamReviewStatus status,
        int reviewableQuestionCount,
        List<ExamReviewQuestionDTO> questions
) {
    /** Mot cau hoi de reviewer cham theo rubric. */
    public record ExamReviewQuestionDTO(
            Long questionId,
            Long sourceQuestionId,
            String content,
            int points,
            /** Cau tra loi cua nguoi thi. */
            String answerText,
            /** Rubric snapshot + mo ta tieu chi (reviewer luon duoc xem). */
            List<ExamReviewCriterionDTO> criteria,
            /** Diem toi da cua cau nay (bang tong trong so cua cac tieu chi). */
            BigDecimal maxPoints,
            /** Dap an mau / huong dan cham (chi xem duoc khi exam cho phep). */
            String referenceAnswer,
            String rubric
    ) {
    }
}
