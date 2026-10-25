package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal; // NEW
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
    private int totalPoints; // tổng tỉ lệ điểm (trọng số) của các câu
    private BigDecimal maxScore; // NEW: thang điểm của đề
    private BigDecimal objectiveScore; // CHANGED: Integer -> BigDecimal
    private BigDecimal finalScore;
    // NEW: điểm tạm = trắc nghiệm (đã trừ muộn) + 0 cho tự luận chưa chấm; bằng finalScore khi đã chấm xong
    private BigDecimal provisionalScore;
    private ExamAttemptStatus status;
    private Instant startedAt;
    private Instant officialDeadlineAt;
    private Instant deadlineAt;
    private Instant submittedAt;
    private boolean late;
    private Integer latePenaltyPercentApplied;
    private Integer attemptsUsed;
    private Integer attemptsRemaining;
    private BigDecimal bestScore; // CHANGED: Integer -> BigDecimal
    private List<QuestionTakerDTO> questions;
    private List<AnswerDTO> answers;

    @Getter
    @Setter
    public static class AnswerDTO {
        private Long questionId;
        private List<Long> selectedOptionIds;
        private String textAnswer;
        // NEW: câu tự luận đã được bấm "Lưu bài" chưa
        private boolean saved;
    }
}
