package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.exception.*;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import com.example.starter_project_2025.system.project.milestone.submission.repository.*;
import com.example.starter_project_2025.system.project.rubric.domain.*;
import com.example.starter_project_2025.system.project.rubric.integration.RubricTenantIdentity;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SubmissionReviewService {
    private final SubmissionQueryService queryService;
    private final MilestoneSubmissionRepository submissions;
    private final SubmissionVersionRepository versions;
    private final RubricVersionRepository rubrics;
    private final MilestoneReviewRepository reviews;
    private final SubmissionAuditRepository audits;
    private final SubmissionOutboxRepository outbox;
    private final CurrentActorProvider actorProvider;
    private final Clock milestoneClock;
    private final ProjectCompletionService projectCompletionService;

    @Transactional
    public SubmissionDtos.Detail review(UUID submissionId, String idempotencyKey,
                                        SubmissionDtos.ReviewRequest request) {
        validateKey(idempotencyKey);
        UUID actorId = actorProvider.requireCurrentActorId();
        String action = "SUBMISSION_" + request.decision().name();
        if (audits.findBySubmissionIdAndActionAndActorIdAndIdempotencyKey(
                submissionId, action, actorId, idempotencyKey.trim()).isPresent()) {
            return queryService.getDetail(submissionId);
        }

        MilestoneSubmission submission = queryService.require(submissionId);
        if (submission.getLockVersion() != request.expectedVersion()) {
            throw new MilestoneConflictException("Submission was changed by another request; reload and try again");
        }
        if (submission.getStatus() != SubmissionStatus.SUBMITTED) {
            throw new MilestoneConflictException("Only a submitted milestone can be reviewed");
        }
        if (request.decision() == ReviewDecision.REQUEST_CHANGES
                && (request.overallFeedback() == null || request.overallFeedback().trim().isEmpty())) {
            throw validation("overallFeedback", "Revision instructions are required and must not exceed 500 characters");
        }
        if (request.decision() == ReviewDecision.REQUEST_CHANGES && !queryService.canRequestChanges(submission)) {
            throw validation("decision", "Không thể yêu cầu nộp lại do Milestone đã hết hạn theo Late Policy");
        }

        SubmissionVersion version = versions.findBySubmissionIdAndVersionNumber(
                        submissionId, submission.getCurrentVersionNumber())
                .orElseThrow(() -> new com.example.starter_project_2025.exception.ResourceNotFoundException(
                        "Submission or milestone does not exist or has changed"));
        if (reviews.existsBySubmissionVersionId(version.getId())) {
            throw new MilestoneConflictException("This submission version has already been reviewed");
        }
        Map<UUID, Boolean> checklist = validateChecklist(request, version);
        RubricVersion rubric = rubrics.findByIdAndRubricTenantId(
                        submission.getMilestone().getRubricSnapshotId(), RubricTenantIdentity.from(submission.getTenantId()))
                .or(() -> rubrics.findByIdAndRubricTenantId(
                        submission.getMilestone().getRubricSnapshotId(), tenantAlias(submission.getTenantId())))
                .orElseThrow(() -> new MilestoneDependencyException("Submission rubric could not be loaded"));

        Map<UUID, SubmissionDtos.CriterionEvaluationRequest> inputs = validateEvaluations(request, rubric);
        BigDecimal rawScore = BigDecimal.ZERO;
        record Resolved(RubricCriterion criterion, RubricCriterionRating rating,
                        SubmissionDtos.CriterionEvaluationRequest input, BigDecimal score) { }
        List<Resolved> resolved = new ArrayList<>();
        for (RubricCriterion criterion : rubric.getCriteria()) {
            SubmissionDtos.CriterionEvaluationRequest input = inputs.get(criterion.getId());
            RubricCriterionRating rating = criterion.getRatings().stream()
                    .filter(item -> item.getLevel() == input.ratingLevel()).findFirst()
                    .orElseThrow(() -> validation("criteria", "Selected rating is not available for this criterion"));
            BigDecimal score = criterion.getMaxScore().multiply(rating.getPercentage())
                    .divide(new BigDecimal("100.00"), 2, RoundingMode.HALF_UP);
            rawScore = rawScore.add(score);
            resolved.add(new Resolved(criterion, rating, input, score));
        }
        BigDecimal penalty = version.getPenaltyPercent();
        BigDecimal finalScore = rawScore.multiply(new BigDecimal("100.00").subtract(penalty))
                .divide(new BigDecimal("100.00"), 2, RoundingMode.HALF_UP);
        if (request.decision() == ReviewDecision.REJECT) {
            rawScore = BigDecimal.ZERO;
            finalScore = BigDecimal.ZERO;
        }
        Instant now = milestoneClock.instant();
        MilestoneReview review = MilestoneReview.create(version, request.decision(), actorId,
                submission.getAssignedReviewerName(), rawScore, penalty, finalScore,
                request.overallFeedback(), now);
        for (Resolved item : resolved) {
            review.addEvaluation(item.criterion().getId(), item.criterion().getCode(),
                    item.criterion().getName(), item.rating().getId(), item.rating().getLevel().name(),
                    item.rating().getPercentage(), item.score(), item.input().feedback(),
                    item.criterion().getOrderIndex());
        }
        reviews.save(review);
        version.applyChecklistReview(checklist);
        version.applyDecision(request.decision());
        submission.reviewed(request.decision(), now);
        submission.getMilestone().setExecutionStatus(submission.getExecutionStatus(), actorId, now);
        versions.save(version);
        submissions.save(submission);
        audits.save(SubmissionAuditLog.create(submissionId, version.getId(), action, actorId,
                idempotencyKey.trim(), now));
        outbox.save(SubmissionOutboxEvent.create(submissionId,
                "MILESTONE_SUBMISSION_" + switch (request.decision()) {
                    case ACCEPT -> "ACCEPTED";
                    case REJECT -> "REJECTED";
                    case REQUEST_CHANGES -> "CHANGES_REQUESTED";
                }, submission.getStudentId(), submission.getMilestone().getId(), now));
        if (request.decision() == ReviewDecision.ACCEPT) {
            projectCompletionService.reevaluate(submission.getTenantId(), submission.getProjectId(),
                    submission.getTeamId(), actorId, now);
        }
        submissions.flush();
        return queryService.getDetail(submissionId);
    }

    private Map<UUID, SubmissionDtos.CriterionEvaluationRequest> validateEvaluations(
            SubmissionDtos.ReviewRequest request, RubricVersion rubric) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        Map<UUID, SubmissionDtos.CriterionEvaluationRequest> result = new LinkedHashMap<>();
        for (int i = 0; i < request.criteria().size(); i++) {
            var item = request.criteria().get(i);
            if (result.putIfAbsent(item.criterionId(), item) != null) {
                errors.put("criteria[" + i + "].criterionId", List.of("Criterion must be evaluated once"));
            }
            if (request.decision() != ReviewDecision.ACCEPT
                    && (item.feedback() == null || item.feedback().trim().isEmpty())) {
                errors.put("criteria[" + i + "].feedback", List.of("Please enter feedback for this criterion"));
            }
            if (item.feedback() != null && item.feedback().trim().length() > 500) {
                errors.put("criteria[" + i + "].feedback", List.of("Feedback must not exceed 500 characters"));
            }
        }
        Set<UUID> expected = rubric.getCriteria().stream().map(RubricCriterion::getId)
                .collect(java.util.stream.Collectors.toSet());
        if (!result.keySet().equals(expected)) {
            errors.put("criteria", List.of("Every rubric criterion must be evaluated exactly once"));
        }
        if (!errors.isEmpty()) throw new MilestoneValidationException(errors);
        return result;
    }

    private Map<UUID, Boolean> validateChecklist(SubmissionDtos.ReviewRequest request,
                                                  SubmissionVersion version) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        Map<UUID, Boolean> result = new LinkedHashMap<>();
        List<SubmissionDtos.ChecklistEvaluationRequest> inputs =
                request.checklist() == null ? List.of() : request.checklist();
        for (int i = 0; i < inputs.size(); i++) {
            var item = inputs.get(i);
            if (result.putIfAbsent(item.checklistItemId(), item.completed()) != null) {
                errors.put("checklist[" + i + "].checklistItemId", List.of("Checklist item must be evaluated once"));
            }
        }
        Set<UUID> expected = version.getChecklist().stream().map(SubmissionChecklistSnapshot::getId)
                .collect(java.util.stream.Collectors.toSet());
        if (!result.keySet().equals(expected)) {
            errors.put("checklist", List.of("Every acceptance checklist item must be evaluated exactly once"));
        }
        if (request.decision() == ReviewDecision.ACCEPT && version.getChecklist().stream()
                .anyMatch(item -> item.isMandatory() && !Boolean.TRUE.equals(result.get(item.getId())))) {
            errors.put("checklist", List.of("All mandatory acceptance checklist items must be checked before accepting"));
        }
        if (!errors.isEmpty()) throw new MilestoneValidationException(errors);
        return result;
    }

    private void validateKey(String key) {
        if (key == null || key.isBlank() || key.trim().length() > 100) {
            throw validation("idempotencyKey", "Idempotency-Key is required and must not exceed 100 characters");
        }
    }

    private UUID tenantAlias(Long tenantId) {
        return UUID.nameUUIDFromBytes(("tenant:" + tenantId)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private MilestoneValidationException validation(String field, String message) {
        return new MilestoneValidationException(Map.of(field, List.of(message)));
    }
}
