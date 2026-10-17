package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExamAttemptSummaryDTO {
    private Long id;
    private Long examId;
    private int attemptNumber;
    private ExamAttemptStatus status;
    private Integer objectiveScore;
    private Integer finalScore;
    private int totalPoints;
    private Integer bestScore;
    private Integer attemptsUsed;
    private Integer attemptsRemaining;
}
