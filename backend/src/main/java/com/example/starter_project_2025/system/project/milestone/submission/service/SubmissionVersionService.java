package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.exception.*;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import com.example.starter_project_2025.system.project.milestone.submission.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SubmissionVersionService {
    private final SubmissionQueryService queryService;
    private final MilestoneSubmissionRepository submissions;
    private final SubmissionVersionRepository versions;
    private final SubmissionAuditRepository audits;
    private final SubmissionOutboxRepository outbox;
    private final CurrentActorProvider actorProvider;
    private final Clock milestoneClock;

    @Transactional
    public SubmissionDtos.Detail createNextVersion(UUID id, SubmissionDtos.CreateVersionRequest request) {
        MilestoneSubmission submission = queryService.require(id);
        if (submission.getStatus() != SubmissionStatus.CHANGES_REQUESTED) {
            throw new MilestoneConflictException("A new version can only be created after changes are requested");
        }
        if (!queryService.canRequestChanges(submission)) {
            throw validation("submission", "Cannot create a new version because the milestone is outside its late policy or attempt limit");
        }
        var now = milestoneClock.instant();
        int number = submission.openNextDraft(now);
        SubmissionVersion version = SubmissionVersion.draft(submission, number, request.title(), request.notes(),
                request.submissionUrl(), actorProvider.requireCurrentActorId(), now);
        applyDraftContent(version, request.artifacts(), request.checklist());
        if (request.checklist() == null || request.checklist().isEmpty()) snapshotMilestoneChecklist(version, submission);
        versions.save(version);
        submissions.saveAndFlush(submission);
        return queryService.getDetail(id);
    }

    @Transactional
    public SubmissionDtos.Detail updateDraft(UUID id, UUID versionId, SubmissionDtos.UpdateDraftRequest request) {
        MilestoneSubmission submission = queryService.require(id);
        if (submission.getStatus() != SubmissionStatus.DRAFT) {
            throw new MilestoneConflictException("Only a draft submission can be edited");
        }
        SubmissionVersion version = versions.findById(versionId)
                .filter(value -> value.getSubmission().getId().equals(id)
                        && value.getVersionNumber() == submission.getCurrentVersionNumber())
                .orElseThrow(() -> new com.example.starter_project_2025.exception.ResourceNotFoundException(
                        "Submission version not found"));
        version.updateDraft(request.title(), request.notes(), request.submissionUrl());
        // Flush orphan removals before recreating ordered rows. Otherwise inserts using
        // order_index=0 can run before the old row is deleted and violate the unique key.
        if (request.artifacts() != null) version.clearArtifacts();
        if (request.checklist() != null && !request.checklist().isEmpty()) version.clearChecklist();
        versions.saveAndFlush(version);
        applyDraftContent(version, request.artifacts(), request.checklist());
        versions.saveAndFlush(version);
        return queryService.getDetail(id);
    }

    @Transactional
    public SubmissionDtos.Detail submit(UUID id, String idempotencyKey) {
        MilestoneSubmission submission = queryService.require(id);
        UUID actorId = actorProvider.requireCurrentActorId();
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw validation("idempotencyKey", "Idempotency-Key is required");
        }
        if (audits.findBySubmissionIdAndActionAndActorIdAndIdempotencyKey(
                id, "SUBMISSION_SUBMITTED", actorId, idempotencyKey.trim()).isPresent()) {
            return queryService.getDetail(id);
        }
        if (submission.getStatus() != SubmissionStatus.DRAFT) {
            throw new MilestoneConflictException("Only a draft submission can be submitted");
        }
        var version = versions.findBySubmissionIdAndVersionNumber(id, submission.getCurrentVersionNumber())
                .orElseThrow(() -> new com.example.starter_project_2025.exception.ResourceNotFoundException(
                        "Submission version not found"));
        var now = milestoneClock.instant();
        boolean late = now.isAfter(submission.getMilestone().getDeadline());
        BigDecimal penalty = BigDecimal.ZERO;
        if (late) {
            if (submission.getMilestone().getLatePolicyType() != LatePolicyType.ALLOW_LATE
                    || submission.getMilestone().getLateUntil() == null
                    || now.isAfter(submission.getMilestone().getLateUntil())) {
                throw validation("submission", "The milestone submission window has closed");
            }
            penalty = submission.getMilestone().getLatePenaltyPercent();
        }
        version.submit(now, late, penalty);
        submission.submitted(version.getVersionNumber(), now);
        versions.save(version);
        submissions.save(submission);
        audits.save(SubmissionAuditLog.create(id, version.getId(), "SUBMISSION_SUBMITTED",
                actorId, idempotencyKey.trim(), now));
        outbox.save(SubmissionOutboxEvent.create(id, "MILESTONE_SUBMISSION_SUBMITTED",
                submission.getAssignedReviewerId(), submission.getMilestone().getId(), now));
        submissions.flush();
        return queryService.getDetail(id);
    }

    private MilestoneValidationException validation(String field, String message) {
        return new MilestoneValidationException(Map.of(field, List.of(message)));
    }

    private void applyDraftContent(SubmissionVersion version,
                                   List<SubmissionDtos.ArtifactRequest> artifacts,
                                   List<SubmissionDtos.ChecklistRequest> checklist) {
        if (artifacts != null) version.replaceArtifacts(artifacts.stream().map(item ->
                new SubmissionVersion.ArtifactValue(item.type(), item.name(), item.url())).toList());
        if (checklist != null && !checklist.isEmpty()) version.replaceChecklist(checklist.stream().map(item ->
                new SubmissionVersion.ChecklistValue(item.sourceChecklistItemId(), item.content(),
                        item.mandatory(), item.completed(), item.evidenceNote())).toList());
    }

    private void snapshotMilestoneChecklist(SubmissionVersion version, MilestoneSubmission submission) {
        version.replaceChecklist(submission.getMilestone().getChecklistItems().stream().map(item ->
                new SubmissionVersion.ChecklistValue(item.getId(), item.getContent(), item.isMandatory(),
                        false, null)).toList());
    }
}
