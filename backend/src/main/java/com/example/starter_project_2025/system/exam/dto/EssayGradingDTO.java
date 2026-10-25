package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal; // NEW
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
public class EssayGradingDTO {

    @Getter
    @Setter
    public static class Summary {
        private Long attemptId;
        private Long studentId;
        private String studentName;
        private String studentEmail;
        private int attemptNumber;
        private ExamAttemptStatus status;
        private Instant submittedAt;
        private int essayCount;
        private int essayAnswered;
    }
    @Getter
    @Setter
    public static class Detail {
        private Long attemptId;
        private Long examId;
        private String examTitle;
        private Long studentId;
        private String studentName;
        private String studentEmail;
        private int attemptNumber;
        private ExamAttemptStatus status;
        private Instant startedAt;
        private Instant submittedAt;
        private int totalPoints;
        private BigDecimal maxScore; // NEW: thang điểm của đề
        private BigDecimal objectiveScore; // CHANGED: Integer -> BigDecimal
        private BigDecimal finalScore;
        private boolean alreadyGraded;
        private List<EssayItem> essays;
    }

    @Getter
    @Setter
    public static class EssayItem {
        private Long questionId;
        private int displayOrder;
        private String content;
        private int points; // tỉ lệ điểm (trọng số) của câu
        private BigDecimal maxScore; // NEW: điểm tối đa quy ra, giáo viên không được chấm vượt quá
        private String answerText;
        private BigDecimal score; // CHANGED: Integer -> BigDecimal
        private String feedback;
    }

    @Getter
    @Setter
    public static class GradeSubmissionRequest {
        private List<QuestionGrade> grades;
        private Boolean confirmOverwrite;
    }

    @Getter
    @Setter
    public static class QuestionGrade {
        private Long questionId;
        private BigDecimal score; // CHANGED: Integer -> BigDecimal
        private String feedback;
    }

    @Getter
    @Setter
    public static class AiGradingResponse {
        private List<AiQuestionProposal> proposals;
    }

    @Getter
    @Setter
    public static class AiQuestionProposal {
        private Long questionId;
        private BigDecimal proposedScore; // CHANGED: Integer -> BigDecimal
        private String feedback;
        private String reasoning;
    }
}
