package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.question.dto.QuestionTakerDTO;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
public class ExamAttemptDTO {
    private Long id;
    private Long examId;
    private int attemptNumber;
    private String title;
    private int durationMinutes;
    private int totalPoints;
    private Integer objectiveScore;
    private Integer finalScore;
    private ExamAttemptStatus status;
    private Instant startedAt;
    private Instant officialDeadlineAt;
    private Instant deadlineAt;
    private Instant submittedAt;
    private boolean late;
    private Integer latePenaltyPercentApplied;
    private Integer attemptsUsed;
    private Integer attemptsRemaining;
    private Integer bestScore;
    private List<QuestionTakerDTO> questions;
    private List<AnswerDTO> answers;

    @Getter
    @Setter
    public static class AnswerDTO {
        private Long questionId;
        private List<Long> selectedOptionIds;
        private String textAnswer;
    }
}
