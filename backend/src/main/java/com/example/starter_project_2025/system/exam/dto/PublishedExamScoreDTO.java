package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal;
import java.time.Instant;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;

public record PublishedExamScoreDTO(
        Long examId,
        String examTitle,
        ExamCategory category,
        int attemptNumber,
        BigDecimal objectiveScore,
        BigDecimal finalScore,
        BigDecimal maxScore,
        BigDecimal firstScore,
        BigDecimal secondScore,

        Instant submittedAt,

        /** Id cua lan lam bai, dung de dinh danh khieng nai diem. */
        Long attemptId,

        /** Ket qua da duoc giao vien cong bo hay chua (chi khi cong bo moi duoc khieng nai). */
        boolean resultPublished,
        /** Diem dat da dong bang cua luot lam (null neu de khong dat diem dat). */
        BigDecimal passScore,
        /** Dat/Truot; null khi chua cong bo, chua co diem hoac de khong dat diem dat. */
        Boolean passed
) {
}
