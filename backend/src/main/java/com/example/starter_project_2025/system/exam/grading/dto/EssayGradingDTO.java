package com.example.starter_project_2025.system.exam.grading.dto;

import java.math.BigDecimal;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
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
        private Long examId;
        private String examTitle;
        private Long studentId;
        private String studentName;
        private String studentEmail;
        private int attemptNumber;
        private ExamAttemptStatus status;
        private Instant submittedAt;
        private int essayCount;
        private int essayAnswered;
        private int aiGradedEssayCount;
        private int codingCount;
        private int codingAnswered;
        private String aiGradingState;
        private BigDecimal aiProposedScore;
        private BigDecimal finalScore;
        private Instant aiGradedAt;
        private String aiGradingError;
        private Long confirmedBy;
        private Instant confirmedAt;
        private BigDecimal maxEssayScore;
        private boolean lowScoreFlagged;
        private String lowScoreReason;
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
        private String aiGradingState;
        private BigDecimal aiProposedEssayScore;
        private Instant aiGradedAt;
        private String aiGradingError;
        private Long confirmedBy;
        private Instant confirmedAt;
        private BigDecimal maxEssayScore;
        private boolean lowScoreFlagged;
        private String lowScoreReason;
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
        private com.example.starter_project_2025.system.question.core.dto.CodeSpecDTO spec;
        /** null = da co diem; PENDING = dang cham nen; RETRYING = may cham loi, se tu thu lai; FAILED = het luot, can cham tay. */
        private String autoGradeState;
        /** Estimated % AI-written (null = too short / not analysed). */
        private Integer aiPercent;
        private String aiLevel;
        private List<String> aiSignals;
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
        /** Estimated % AI-written (null = too short / not analysed). */
        private Integer aiPercent;
        private String aiLevel;
        private List<String> aiSignals;
        private BigDecimal score;
        private String feedback;
        private String referenceAnswer;
        private Instant referenceSubmittedAt;
        private String rubric;
        private Instant rubricSubmittedAt;
        /** true neu Reference/Rubric da duoc chup (bai da cham); sua rubric sau do khong anh huong bai nay. */
        private boolean guidelineFrozen;
        private Instant guidelineSnapshotAt;
        private List<GradingCriterion> gradingCriteria;
        private AiQuestionProposal aiProposal;
        private Instant aiGradedAt;
        private String aiGradingStatus;
        private String aiGradingError;
    }

    @Getter
    @Setter
    public static class QuestionGuidelineDTO {
        private Long examId;
        private Long questionId;
        private String referenceAnswer;
        private Instant referenceSubmittedAt;
        private String rubric;
        private Instant rubricSubmittedAt;
    }

    @Getter
    @Setter
    public static class SubmitReferenceRequest {
        private String referenceAnswer;
    }

    @Getter
    @Setter
    public static class SubmitRubricRequest {
        private String rubric;
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

    @Getter
    @Setter
    public static class BatchPreviewDTO {
        private Long examId;
        private String examTitle;
        private int totalSubmitted;
        private int eligibleCount;
        private int alreadyAiGradedCount;
        private int ungradedCount;
        private int failedCount;
        private int confirmedCount;
        private int ineligibleCount;
        private int lowScoreFlaggedCount;
        private int autoConfirmableCount;
        private Long activeBatchId;
        private String activeBatchStatus;
        private String savedReferenceAnswer;
        private String savedRubric;
    }

    @Getter
    @Setter
    public static class StartBatchRequest {
        /** UNGRADED_ONLY (default), FAILED_ONLY, ALL_ELIGIBLE */
        private String scope;
        private List<Long> attemptIds;
        private Boolean forceRegrade;
        private String referenceAnswer;
        private String rubric;
        private Boolean autoGenerateGuidelines;
    }

    @Getter
    @Setter
    public static class BulkConfirmRequest {
        /** Phai truyen "APPLY ALL" (khong phan biet hoa thuong) de tranh bam nham. */
        private String confirmationText;
        private List<Long> attemptIds;
    }

    @Getter
    @Setter
    public static class BulkConfirmResultDTO {
        private Long examId;
        private int confirmedCount;
        private int skippedLowScoreCount;
        private int skippedFailedCount;
        private List<Long> confirmedAttemptIds;
        private List<Long> skippedLowScoreAttemptIds;
        private String message;
    }

    @Getter
    @Setter
    public static class BatchStatusDTO {
        private Long batchId;
        private Long examId;
        private String examTitle;
        private Long triggeredByUserId;
        private String scope;
        private String status;
        private int totalAttempts;
        private int pendingCount;
        private int processingCount;
        private int completedCount;
        private int failedCount;
        private int skippedCount;
        private double progressPercent;
        private boolean notificationSent;
        private Instant startedAt;
        private Instant completedAt;
        private String lastError;
        private List<BatchItemDTO> items;
    }

    @Getter
    @Setter
    public static class BatchItemDTO {
        private Long itemId;
        private Long attemptId;
        private Long examId;
        private Long studentId;
        private String studentName;
        private String status;
        private int retryCount;
        private int essayCount;
        private int aiGradedEssayCount;
        private BigDecimal proposedTotalEssayScore;
        private String errorMessage;
        private Instant startedAt;
        private Instant finishedAt;
    }
}
