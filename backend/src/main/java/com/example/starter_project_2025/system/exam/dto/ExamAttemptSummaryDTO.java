package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class ExamAttemptSummaryDTO {
    private Long id;
    private Long examId;
    private int attemptNumber;
    private ExamAttemptStatus status;
    private BigDecimal objectiveScore;
    private BigDecimal finalScore;
    private int totalPoints;
    private BigDecimal maxScore;
    private BigDecimal bestScore;
    private BigDecimal passScore;
    /** Dat/Truot theo diem dat da dong bang; chi co khi ket qua da cong bo va da co diem cuoi. */
    private Boolean passed;

    /** Ket qua da duoc giao vien cong bo (Publish Results) hay chua. */
    private boolean resultPublished;

    private Integer attemptsUsed;
    private Integer attemptsRemaining;
    private Instant startedAt;
    private Instant deadlineAt;
    private Instant submittedAt;
}
