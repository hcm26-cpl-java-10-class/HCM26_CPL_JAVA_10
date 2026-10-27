package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import com.example.starter_project_2025.system.project.milestone.submission.repository.*;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SubmissionQueryService {
    private static final Map<String, String> SORTS = Map.of(
            "milestoneTitle", "milestone.title", "teamName", "teamName", "studentName", "studentName",
            "status", "status", "executionStatus", "executionStatus", "submittedAt", "submittedAt",
            "deadline", "milestone.deadline");

    private final MilestoneSubmissionRepository submissions;
    private final SubmissionVersionRepository versions;
    private final MilestoneReviewRepository reviews;
    private final MilestoneArtifactSubmissionRepository artifactSubmissions;
    private final RubricVersionRepository rubrics;
    private final MilestoneTenantProvider tenantProvider;
    private final CurrentActorProvider actorProvider;
    private final Clock milestoneClock;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public SubmissionDtos.PageResponse getPage(Long projectId, int page, int size, String search,
                                               SubmissionStatus status,
                                               MilestoneExecutionStatus executionStatus,
                                               Boolean mandatory, Boolean late, String bucket, String sort) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        var result = submissions.findAll(MilestoneSubmissionSpecifications.matching(
                        tenantProvider.requireCurrentTenantId(), projectId, null, null, normalize(search), status,
                        executionStatus, mandatory, late, null, null, normalizeBucket(bucket)),
                PageRequest.of(safePage, safeSize, parseSort(sort)));
        return new SubmissionDtos.PageResponse(result.getContent().stream().map(this::toListItem).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages(),
                result.hasNext(), result.hasPrevious());
    }

    @Transactional(readOnly = true)
    public SubmissionDtos.PageResponse getMyPage(Long projectId, int page, int size, String search,
                                                 SubmissionStatus status, String sort) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        var result = submissions.findAll(MilestoneSubmissionSpecifications.matching(
                        tenantProvider.requireCurrentTenantId(), projectId, null, null, normalize(search), status,
                        null, null, null, null, actorProvider.requireCurrentActorId(), "ALL"),
                PageRequest.of(safePage, safeSize, parseSort(sort)));
        return new SubmissionDtos.PageResponse(result.getContent().stream().map(this::toListItem).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages(),
                result.hasNext(), result.hasPrevious());
    }

    @Transactional(readOnly = true)
    public SubmissionDtos.Detail getMyDetail(UUID submissionId) {
        MilestoneSubmission submission = requireMine(submissionId);
        return detail(submission);
    }

    @Transactional(readOnly = true)
    public SubmissionDtos.Detail getDetail(UUID submissionId) {
        return detail(require(submissionId));
    }

    private SubmissionDtos.Detail detail(MilestoneSubmission submission) {
        UUID submissionId = submission.getId();
        List<SubmissionVersion> versionList = versions.findAllBySubmissionIdOrderByVersionNumberDesc(submissionId);
        SubmissionVersion current = versionList.stream()
                .filter(item -> item.getVersionNumber() == submission.getCurrentVersionNumber())
                .findFirst().orElseThrow(() -> new ResourceNotFoundException("Submission version not found"));
        RubricVersion rubric = rubrics.findByIdAndRubricTenantId(
                        submission.getMilestone().getRubricSnapshotId(), tenantAlias(submission.getTenantId()))
                .orElseThrow(() -> new ResourceNotFoundException("Submission rubric not found"));
        List<MilestoneReview> reviewList = reviews
                .findAllBySubmissionVersionSubmissionIdOrderByReviewedAtDesc(submissionId);
        return toDetail(submission, current, versionList, rubric, reviewList);
    }

    MilestoneSubmission require(UUID id) {
        return submissions.findByIdAndTenantId(id, tenantProvider.requireCurrentTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Submission or milestone does not exist or has changed"));
    }

    MilestoneSubmission requireMine(UUID id) {
        MilestoneSubmission submission = require(id);
        if (!submission.getStudentId().equals(actorProvider.requireCurrentActorId())) {
            throw new ResourceNotFoundException("Submission does not exist");
        }
        return submission;
    }

    private UUID tenantAlias(Long tenantId) {
        return UUID.nameUUIDFromBytes(("tenant:" + tenantId)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private SubmissionDtos.ListItem toListItem(MilestoneSubmission value) {
        SubmissionVersion current = versions.findBySubmissionIdAndVersionNumber(
                value.getId(), value.getCurrentVersionNumber()).orElse(null);
        int checklistTotal = current == null || current.getChecklist().isEmpty()
                ? value.getMilestone().getChecklistItems().size() : current.getChecklist().size();
        int checklistCompleted = current == null || current.getChecklist().isEmpty()
                ? (int) value.getMilestone().getChecklistItems().stream().filter(item -> item.isCompleted()).count()
                : (int) current.getChecklist().stream().filter(item -> item.isCompleted()).count();
        return new SubmissionDtos.ListItem(value.getId(), value.getProjectId(), value.getMilestone().getId(),
                value.getMilestone().getTitle(), value.getMilestone().isMandatory(), value.getTeamId(),
                value.getTeamName(), value.getStudentName(), value.getAssignedReviewerName(), value.getStatus(),
                value.getExecutionStatus(), value.getCurrentVersionNumber(), value.getSubmissionAttempts(),
                value.getMilestone().getDeadline(), value.getSubmittedAt(), current != null && current.isLate(),
                current == null ? java.math.BigDecimal.ZERO : current.getPenaltyPercent(), value.getLockVersion(),
                checklistCompleted, checklistTotal);
    }

    private SubmissionDtos.Detail toDetail(MilestoneSubmission value, SubmissionVersion current,
                                           List<SubmissionVersion> versionList, RubricVersion rubric,
                                           List<MilestoneReview> reviewList) {
        boolean requestAllowed = canRequestChanges(value);
        Map<String, Boolean> actions = new LinkedHashMap<>();
        actions.put("accept", value.getStatus() == SubmissionStatus.SUBMITTED);
        actions.put("reject", value.getStatus() == SubmissionStatus.SUBMITTED);
        actions.put("requestChanges", value.getStatus() == SubmissionStatus.SUBMITTED && requestAllowed);
        actions.put("createNextVersion", value.getStatus() == SubmissionStatus.CHANGES_REQUESTED && requestAllowed);
        actions.put("submit", value.getStatus() == SubmissionStatus.DRAFT);

        return new SubmissionDtos.Detail(value.getId(), value.getProjectId(), value.getMilestone().getId(),
                value.getMilestone().getTitle(), value.getMilestone().getDescription(),
                value.getMilestone().isMandatory(), value.getTeamId(), value.getTeamName(), value.getStudentId(),
                value.getStudentName(), value.getAssignedReviewerId(), value.getAssignedReviewerName(),
                value.getStatus(), value.getExecutionStatus(), value.getCurrentVersionNumber(),
                value.getSubmissionAttempts(), value.getMilestone().isAllowResubmission(),
                value.getMilestone().getMaxSubmissionAttempts(), value.getMilestone().getDeadline(),
                value.getMilestone().getLatePolicyType().name(), value.getMilestone().getLateUntil(),
                value.getMilestone().getLatePenaltyPercent(), value.getLockVersion(), product(value, current), map(current),
                versionList.stream().map(this::map).toList(), map(rubric),
                reviewList.stream().map(this::map).toList(), actions);
    }

    private SubmissionDtos.ProductInfo product(MilestoneSubmission submission, SubmissionVersion current) {
        Optional<MilestoneArtifactSubmission> linked = current.getArtifactSubmissionId() == null
                ? Optional.empty() : artifactSubmissions.findById(current.getArtifactSubmissionId());
        Optional<MilestoneArtifactSubmission> byProject = submission.getProjectId() == null
                ? Optional.empty()
                : artifactSubmissions.findTopByTenantIdAndProjectIdAndMilestoneIdOrderBySubmittedAtDesc(
                        submission.getTenantId(), submission.getProjectId(), submission.getMilestone().getId());
        Optional<MilestoneArtifactSubmission> byTeam = submission.getTeamId() == null
                ? Optional.empty()
                : artifactSubmissions.findTopByTenantIdAndTeamIdAndMilestoneIdOrderBySubmittedAtDesc(
                        submission.getTenantId(), submission.getTeamId(), submission.getMilestone().getId());
        MilestoneArtifactSubmission product = linked.orElseGet(() -> java.util.stream.Stream.of(byProject, byTeam)
                .flatMap(Optional::stream)
                .max(Comparator.comparing(MilestoneArtifactSubmission::getSubmittedAt))
                .orElse(null));
        if (product == null) return null;
        try {
            List<SubmissionDtos.ProductAttachment> attachments = objectMapper.readValue(
                    product.getAttachmentsJson(), new TypeReference<>() { });
            return new SubmissionDtos.ProductInfo(product.getVersion(), product.getRepositoryUrl(),
                    product.getDeploymentUrl(), product.getReleaseNotes(), attachments,
                    product.getSubmittedAt(), product.isSubmittedLate(), product.getLatePenaltyPercent());
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Stored artifact product snapshot is invalid", ex);
        }
    }

    boolean canRequestChanges(MilestoneSubmission value) {
        var milestone = value.getMilestone();
        if (!milestone.isAllowResubmission()) return false;
        if (milestone.getMaxSubmissionAttempts() != null
                && value.getSubmissionAttempts() >= milestone.getMaxSubmissionAttempts()) return false;
        var now = milestoneClock.instant();
        if (!now.isAfter(milestone.getDeadline())) return true;
        return milestone.getLatePolicyType().name().equals("ALLOW_LATE")
                && milestone.getLateUntil() != null && !now.isAfter(milestone.getLateUntil());
    }

    private SubmissionDtos.Version map(SubmissionVersion value) {
        List<SubmissionDtos.Artifact> artifacts = value.getArtifacts().stream().map(item ->
                new SubmissionDtos.Artifact(item.getId(), item.getType(), item.getName(), item.getUrl(),
                        item.getOrderIndex())).toList();
        if (artifacts.isEmpty() && value.getSubmissionUrl() != null) {
            artifacts = List.of(new SubmissionDtos.Artifact(null, SubmissionArtifactType.OTHER,
                    "Submitted work", value.getSubmissionUrl(), 0));
        }
        List<SubmissionDtos.ChecklistSnapshot> checklist = value.getChecklist().stream().map(item ->
                new SubmissionDtos.ChecklistSnapshot(item.getId(), item.getSourceChecklistItemId(),
                        item.getContent(), item.isMandatory(), item.isCompleted(), item.getEvidenceNote(),
                        item.getOrderIndex())).toList();
        if (checklist.isEmpty()) {
            checklist = value.getSubmission().getMilestone().getChecklistItems().stream().map(item ->
                    new SubmissionDtos.ChecklistSnapshot(null, item.getId(), item.getContent(),
                            item.isMandatory(), false, null, item.getOrderIndex())).toList();
        }
        return new SubmissionDtos.Version(value.getId(), value.getVersionNumber(), value.getTitle(),
                value.getNotes(), value.getSubmissionUrl(), value.getStatus(), value.getSubmittedAt(),
                value.getSubmittedBy(), value.isLate(), value.getPenaltyPercent(), artifacts, checklist);
    }

    private SubmissionDtos.Rubric map(RubricVersion value) {
        return new SubmissionDtos.Rubric(value.getId(), value.getNameSnapshot(),
                "v" + value.getVersionNumber(), value.getTotalMaxScore(), value.getCriteria().stream().map(c ->
                new SubmissionDtos.Criterion(c.getId(), c.getCode(), c.getName(), c.getDescription(),
                        c.getWeight(), c.getMaxScore(), c.getOrderIndex(), c.getRatings().stream().map(r ->
                        new SubmissionDtos.Rating(r.getId(), r.getLevel(), r.getPercentage(),
                                r.getDescription(), r.getOrderIndex())).toList())).toList());
    }

    private SubmissionDtos.Review map(MilestoneReview value) {
        return new SubmissionDtos.Review(value.getId(), value.getSubmissionVersion().getId(),
                value.getSubmissionVersion().getVersionNumber(), value.getDecision(), value.getReviewerName(),
                value.getRawScore(), value.getPenaltyPercent(), value.getFinalScore(), value.getReviewedAt(),
                value.getOverallFeedback(), value.getEvaluations().stream().map(item -> new SubmissionDtos.Evaluation(
                        item.getCriterionId(), item.getCriterionCode(), item.getCriterionName(), item.getRatingId(),
                        item.getRatingLevel(), item.getRatingPercentage(), item.getScore(), item.getFeedback(),
                        item.getOrderIndex())).toList());
    }

    private Sort parseSort(String sort) {
        if (sort == null || sort.isBlank()) return Sort.by(Sort.Order.desc("submittedAt").nullsLast(), Sort.Order.asc("id"));
        String[] parts = sort.replace(',', ':').split(":", -1);
        String property = parts.length == 2 ? SORTS.get(parts[0]) : null;
        if (property == null || !(parts[1].equalsIgnoreCase("asc") || parts[1].equalsIgnoreCase("desc"))) {
            property = "submittedAt";
            return Sort.by(Sort.Order.desc(property).nullsLast(), Sort.Order.asc("id"));
        }
        return Sort.by(new Sort.Order(parts[1].equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC,
                property), Sort.Order.asc("id"));
    }

    private static String normalize(String value) {
        return value == null ? null : value.trim().replaceAll("\\s+", " ").toLowerCase();
    }

    private static String normalizeBucket(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().toUpperCase();
        return Set.of("PENDING", "REVIEWED", "ALL").contains(normalized) ? normalized : null;
    }
}
