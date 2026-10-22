package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
public class ExamAttemptReviewDTO {
    private Long attemptId;
    private Long examId;
    private String title;
    private int attemptNumber;
    private ExamAttemptStatus status;
    private int totalPoints;
    private Integer objectiveScore;
    private Integer finalScore;
    private Instant submittedAt;
    private List<QuestionReviewDTO> questions;

    @Getter
    @Setter
    public static class QuestionReviewDTO {
        private Long questionId;
        private String content;
        private String imageUrl;
        private QuestionType type;
        private int points;
        // null với câu tự luận (không có đáp án đúng cố định)
        private Boolean correct;
        private List<OptionReviewDTO> options;
        private String textAnswer;
        private Integer score;
        private String feedback;
    }

    @Getter
    @Setter
    public static class OptionReviewDTO {
        private Long id;
        private String content;
        private String imageUrl;
        private boolean correct;
        private boolean selected;
    }
}
