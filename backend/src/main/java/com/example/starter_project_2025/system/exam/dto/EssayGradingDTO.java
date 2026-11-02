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
        private int codingCount;
        private int codingAnswered;
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
        private List<CodingItem> codings;
        /** Bai da duoc giao vien sua diem tay (co diem 1/diem 2): khong cho cham lai coding tu dong. */
        private boolean scoreAdjusted;
    }

    @Getter
    @Setter
    public static class CodingItem {
        private Long questionId;
        private int displayOrder;
        private String content;
        private int points;
        private BigDecimal maxScore;
        /** Code sinh vien nop. */
        private String code;
        private BigDecimal score;
        private String feedback;
        /** Khai bao ham + toan bo test (ca test an) cho giao vien. */
        private com.example.starter_project_2025.system.question.dto.CodeSpecDTO spec;
        /** null = da co diem; PENDING = dang cham nen; RETRYING = may cham loi, se tu thu lai; FAILED = het luot, can cham tay. */
        private String autoGradeState;
        /** Trang thai tung test (OK, WRONG_ANSWER, ...) cua lan cham tu dong da luu; null neu chua co. */
        private List<String> testStatuses;
    }

    @Getter
    @Setter
    public static class CodingTestResult {
        private int index;
        private boolean visible;
        private boolean passed;
        /** OK, WRONG_ANSWER, COMPILE_ERROR, RUNTIME_ERROR, TIME_LIMIT, INFRA_ERROR, NO_CODE */
        private String status;
        private List<String> inputs;
        private String expected;
        private String actual;
        private String error;
    }

    @Getter
    @Setter
    public static class CodingRunResult {
        private int passed;
        private int total;
        private boolean infraError;
        private List<CodingTestResult> tests;
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
        private String explanation;
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
