package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.question.domain.QuestionType;

import java.util.List;
import java.util.Map;

/** Phan tich cau hoi (item analysis) + ty le hoan thanh cua mot ky thi. */
public record ExamItemAnalysisDTO(
        Long examId,
        String examTitle,
        CompletionDTO completion,
        /** So luot thi da cham xong duoc dua vao phan tich cau hoi. */
        int analyzedAttempts,
        /** Co du mau de tinh do phan biet hay khong. */
        boolean discriminationAvailable,
        int minAttemptsForDiscrimination,
        /** null = D dang tin cay; TOO_FEW_ATTEMPTS | SCORES_TOO_CLOSE | GROUPS_OVERLAP = khong nen tin D. */
        String discriminationProblem,
        Double averageDifficultyIndex,
        int flaggedItems,
        List<ItemDTO> items
) {

    public record CompletionDTO(
            long started,
            long submitted,
            long inProgress,
            long expired,
            long pendingReview,
            /** submitted / started, 0..1; null neu chua co luot thi nao. */
            Double completionRate,
            Double averageDurationMinutes
    ) {
    }

    public record ItemDTO(
            Long sourceQuestionId,
            int order,
            String content,
            QuestionType type,
            int points,
            /** So luot thi co cau nay (da cham xong). */
            int attempts,
            int answered,
            Double answerRate,
            /** So luot dat diem toi da cua cau. */
            int fullyCorrect,
            Double correctRate,
            /** Chi so do kho p = diem trung binh / diem toi da (0..1; cang cao cang de). */
            Double difficultyIndex,
            String difficultyLevel,
            /** Do phan biet D = p(nhom 27% cao) - p(nhom 27% thap); null neu chua du mau. */
            Double discrimination,
            String discriminationLevel,
            List<String> flags,
            List<OptionStatDTO> options,
            /** Chi co voi cau lap trinh. */
            CodeStatDTO code
    ) {
    }

    /** Thong ke cau lap trinh dua tren ket qua tung test luc cham. */
    public record CodeStatDTO(
            /** So bai co du lieu ket qua tung test (bai cham truoc khi co tinh nang nay thi khong co). */
            int graded,
            int compileErrors,
            int noCode,
            int timeouts,
            int runtimeErrors,
            List<CodeTestStatDTO> tests
    ) {
    }

    public record CodeTestStatDTO(
            int index,
            boolean visible,
            List<String> inputs,
            String expected,
            int evaluated,
            int passed,
            Double passRate,
            /** Dem theo trang thai: OK, WRONG_ANSWER, COMPILE_ERROR, RUNTIME_ERROR, TIME_LIMIT, NO_CODE... */
            Map<String, Integer> statusCounts
    ) {
    }

    public record OptionStatDTO(
            Long sourceOptionId,
            String content,
            boolean correct,
            int selectedCount,
            Double selectedRate
    ) {
    }
}
