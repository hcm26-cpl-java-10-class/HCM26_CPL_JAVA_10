package com.example.starter_project_2025.system.project.milestone.submission.dto;

import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.rubric.domain.RubricRatingLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class SubmissionDtos {
    private SubmissionDtos() { }

    public record PageResponse(List<ListItem> content, int page, int size, long totalElements,
                               int totalPages, boolean hasNext, boolean hasPrevious) { }

    public record ListItem(UUID id, UUID projectId, UUID milestoneId, String milestoneTitle,
                           boolean mandatory, UUID teamId, String teamName, String studentName,
                           String reviewerName, SubmissionStatus status,
                           MilestoneExecutionStatus executionStatus, int currentVersionNumber,
                           int submissionAttempts, Instant deadline, Instant submittedAt,
                           boolean late, BigDecimal penaltyPercent, long lockVersion,
                           int checklistCompleted, int checklistTotal) { }

    public record Detail(UUID id, UUID projectId, UUID milestoneId, String milestoneTitle,
                         String milestoneDescription, boolean mandatory, UUID teamId, String teamName,
                         UUID studentId, String studentName, UUID assignedReviewerId,
                         String assignedReviewerName, SubmissionStatus status,
                         MilestoneExecutionStatus executionStatus, int currentVersionNumber,
                         int submissionAttempts, boolean allowResubmission,
                         Integer maxSubmissionAttempts, Instant deadline, String latePolicyType,
                         Instant lateUntil, BigDecimal latePenaltyPercent, long lockVersion,
                         Version currentVersion, List<Version> versions, Rubric rubric,
                         List<Review> reviews, Map<String, Boolean> availableActions) { }

    public record Version(UUID id, int versionNumber, String title, String notes,
                          String submissionUrl, SubmissionStatus status, Instant submittedAt,
                          UUID submittedBy, boolean late, BigDecimal penaltyPercent,
                          List<Artifact> artifacts, List<ChecklistSnapshot> checklist) { }

    public record Artifact(UUID id, SubmissionArtifactType type, String name, String url,
                           int orderIndex) { }

    public record ChecklistSnapshot(UUID id, UUID sourceChecklistItemId, String content,
                                    boolean mandatory, boolean completed, String evidenceNote,
                                    int orderIndex) { }

    public record Rubric(UUID versionId, String name, String version,
                         BigDecimal totalMaxScore, List<Criterion> criteria) { }

    public record Criterion(UUID id, String code, String name, String description,
                            BigDecimal weight, BigDecimal maxScore, int orderIndex,
                            List<Rating> ratings) { }

    public record Rating(UUID id, RubricRatingLevel level, BigDecimal percentage,
                         String description, int orderIndex) { }

    public record Review(UUID id, UUID submissionVersionId, int versionNumber,
                         ReviewDecision decision, String reviewerName, BigDecimal rawScore,
                         BigDecimal penaltyPercent, BigDecimal finalScore, Instant reviewedAt,
                         String overallFeedback, List<Evaluation> evaluations) { }

    public record Evaluation(UUID criterionId, String criterionCode, String criterionName,
                             UUID ratingId, String ratingLevel, BigDecimal ratingPercentage,
                             BigDecimal score, String feedback, int orderIndex) { }

    public record CriterionEvaluationRequest(
            @NotNull(message = "Criterion is required") UUID criterionId,
            @NotNull(message = "Rating level is required") RubricRatingLevel ratingLevel,
            @Size(max = 500, message = "Feedback must not exceed 500 characters") String feedback) { }

    /** A reviewer decision for one immutable acceptance-checklist snapshot item. */
    public record ChecklistEvaluationRequest(
            @NotNull(message = "Checklist item is required") UUID checklistItemId,
            boolean completed) { }

    public record ReviewRequest(
            @NotNull(message = "Decision is required") ReviewDecision decision,
            @NotNull(message = "Expected submission version is required") @Min(0) Long expectedVersion,
            @NotEmpty(message = "Rubric evaluation is required")
            List<@Valid CriterionEvaluationRequest> criteria,
            List<@Valid ChecklistEvaluationRequest> checklist,
            @Size(max = 1000, message = "Overall feedback must not exceed 1000 characters")
            String overallFeedback) { }

    public record CreateVersionRequest(
            @NotBlank @Size(max = 160) String title,
            @Size(max = 2000) String notes,
            @Size(max = 1000) String submissionUrl,
            List<@Valid ArtifactRequest> artifacts) {
        public CreateVersionRequest(String title, String notes, String submissionUrl) {
            this(title, notes, submissionUrl, List.of());
        }
    }

    public record UpdateDraftRequest(
            @NotBlank @Size(max = 160) String title,
            @Size(max = 2000) String notes,
            @Size(max = 1000) String submissionUrl,
            @Size(max = 20) List<@Valid ArtifactRequest> artifacts) { }

    public record ArtifactRequest(
            @NotNull SubmissionArtifactType type,
            @NotBlank @Size(max = 160) String name,
            @NotBlank @Size(max = 1000) String url) { }

    public record LockFinalGradeRequest(
            @NotNull @DecimalMin("0.00") @DecimalMax("100.00") @Digits(integer = 3, fraction = 2)
            BigDecimal finalScore) { }

    public record WaiveMilestoneRequest(
            @NotBlank @Size(max = 500) String reason) { }

    public record ProjectCompletionResult(UUID projectId, UUID teamId, boolean completed,
                                          boolean gradeLocked, String trigger) { }
}
