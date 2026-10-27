package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.List;
import java.util.Map;

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
        private BigDecimal maxScore;
        private BigDecimal objectiveScore;
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
        private int points;
        private BigDecimal maxScore;
        private String answerText;
        private BigDecimal score;
        private String feedback;
        private String referenceAnswer;
        private String rubric;
        private List<GradingCriterion> gradingCriteria;
    }

    @Getter
    @Setter
    public static class GradingCriterion {
        private String name;
        private String description;
        private int weightPercentage;
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
        private BigDecimal score;
        private String feedback;
    }

    @Getter
    @Setter
    public static class AiGradingRequest {
        private Map<Long, QuestionContext> questions;
    }

    @Getter
    @Setter
    public static class QuestionContext {
        private String referenceAnswer;
        private String rubric;
    }

    @Getter
    @Setter
    public static class AiGradingResponse {
        private String model;
        private List<AiQuestionProposal> proposals;
    }

    @Getter
    @Setter
    public static class CriterionScore {
        private String criterion;
        private Integer maxPoints;
        private Integer awardedPoints;
        private String comment;
    }

    @Getter
    @Setter
    public static class AiQuestionProposal {
        private Long questionId;
        private BigDecimal proposedScore;
        private String feedback;
        private String reasoning;
        private String analysis;
        private List<CriterionScore> criterionScores;
        private Boolean flagAmbiguous;
        private String flagReason;
    }
}
