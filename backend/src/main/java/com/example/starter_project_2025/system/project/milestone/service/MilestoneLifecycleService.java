package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.audit.*;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.dto.request.*;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneResponse;
import com.example.starter_project_2025.system.project.milestone.exception.*;
import com.example.starter_project_2025.system.project.milestone.integration.port.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class MilestoneLifecycleService {
    private final MilestoneRepository milestones;
    private final MilestoneSubmissionRepository submissions;
    private final com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactDraftRepository artifactDrafts;
    private final com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository backlogs;
    private final MilestoneTenantProvider tenants;
    private final CurrentActorProvider actors;
    private final ProjectMilestonePort projects;
    private final WorkspaceMilestoneScopeService scopes;
    private final MilestoneAccessPolicy access;
    private final MilestoneValidator validator;
    private final RubricCatalogPort rubrics;
    private final MilestoneMapper mapper;
    private final MilestoneAuditRepository audits;
    private final com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventWriter outbox;
    private final Clock milestoneClock;

    @Transactional
    public MilestoneResponse saveDraft(Long projectId, Long teamId, MilestoneDraftRequest request) {
        Long tenant = tenants.requireCurrentTenantId(); UUID actor = actors.requireCurrentActorId();
        Long resolvedProject = scopes.requireTeamScope(projectId, teamId, tenant).projectId();
        if (resolvedProject != null) access.requireAccess(projects.requireProjectForCreation(resolvedProject, actor, tenant));
        if (request.title() == null || request.title().isBlank() || request.title().length() > 120)
            throw new MilestoneValidationException(Map.of("title", List.of("Title is required (max 120 characters)")));
        Instant now = milestoneClock.instant();
        Milestone value = Milestone.create(tenant, resolvedProject, teamId, request.title().trim(), request.description(),
                request.deadline(), Boolean.TRUE.equals(request.mandatory()), request.rubricSnapshotId(), null,
                request.latePolicyType(), request.lateUntil(), request.latePenaltyPercent(), actor, now);
        value.configureAssessment(request.weight(), null);
        if (request.checklist() != null) value.replaceChecklist(request.checklist());
        milestones.saveAndFlush(value);
        audit(value, actor, "MILESTONE_DRAFT_SAVED", "{}", now);
        return mapper.toResponse(value);
    }

    @Transactional
    public MilestoneResponse editDraft(Long projectId, Long teamId, UUID id, MilestoneDraftRequest request) {
        Milestone value = require(projectId, teamId, id);
        checkVersion(value, request.expectedVersion());
        if (value.getStatus() != MilestoneStatus.PLANNED) throw new MilestoneConflictException("Only draft milestones can be edited");
        UUID actor = actors.requireCurrentActorId(); Instant now = milestoneClock.instant();
        if (request.title() == null || request.title().isBlank() || request.title().length() > 120)
            throw new MilestoneValidationException(Map.of("title", List.of("Title is required (max 120 characters)")));
        value.editDraft(request.title().trim(), request.description(), request.deadline(), Boolean.TRUE.equals(request.mandatory()),
                request.rubricSnapshotId(), request.latePolicyType(), request.lateUntil(), request.latePenaltyPercent(),
                request.weight(), actor, now);
        value.replaceChecklist(request.checklist());
        value.configureResubmission(Boolean.TRUE.equals(request.allowResubmission()), request.maxSubmissionAttempts());
        milestones.saveAndFlush(value);
        audit(value, actor, "MILESTONE_DRAFT_UPDATED", "{}", now);
        return mapper.toResponse(value);
    }

    @Transactional
    public MilestoneResponse publish(Long projectId, Long teamId, UUID id, long expectedVersion) {
        Milestone value = require(projectId, teamId, id); checkVersion(value, expectedVersion);
        if (value.getStatus() != MilestoneStatus.PLANNED) throw new MilestoneConflictException("Only drafts can be published");
        Map<String,List<String>> missing = new LinkedHashMap<>();
        if (value.getDeadline() == null) missing.put("deadline", List.of("Deadline is required"));
        if (value.getRubricSnapshotId() == null) missing.put("rubricSnapshotId", List.of("Rubric is required"));
        if (value.getLatePolicyType() == null) missing.put("latePolicy", List.of("Late policy is required"));
        if (value.getChecklistItems().isEmpty()) missing.put("checklist", List.of("At least one checklist item is required"));
        if (!missing.isEmpty()) throw new MilestoneValidationException(missing);
        UUID actor = actors.requireCurrentActorId(); Long tenant = tenants.requireCurrentTenantId(); Instant now = milestoneClock.instant();
        var rubric = rubrics.requireAllowedSnapshot(value.getRubricSnapshotId(), value.getProjectId(), actor, tenant);
        var checklist = value.getChecklistItems().stream().map(i -> new ChecklistItemRequest(i.getContent(), i.isMandatory(), i.getOrderIndex())).toList();
        validator.validate(new CreateMilestoneRequest(value.getTeamId(), value.getTitle(), value.getDescription(), value.getDeadline(),
                value.isMandatory(), checklist, value.getRubricSnapshotId(), null,
                new LatePolicyRequest(value.getLatePolicyType(), value.getLateUntil(), value.getLatePenaltyPercent()),
                new ResubmissionPolicyRequest(value.isAllowResubmission(), value.getMaxSubmissionAttempts()), value.getWeight()), rubric, now);
        value.openForWork(actor, now); milestones.saveAndFlush(value);
        audit(value, actor, "MILESTONE_PUBLISHED", "{\"before\":\"DRAFT\",\"after\":\"TODO\"}", now);
        outbox.writeMilestoneOpened(value, now);
        return mapper.toResponse(value);
    }

    @Transactional
    public MilestoneResponse start(Long projectId, Long teamId, UUID id, long expectedVersion) {
        Milestone value = require(projectId, teamId, id); checkVersion(value, expectedVersion);
        UUID actor = actors.requireCurrentActorId(); Instant now = milestoneClock.instant();
        if (value.getStatus() != MilestoneStatus.OPEN || value.getExecutionStatus() != com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.TODO)
            throw new MilestoneConflictException("Only a published TODO milestone can start");
        value.start(actor, now); milestones.saveAndFlush(value);
        audit(value, actor, "MILESTONE_STARTED", "{}", now);
        return mapper.toResponse(value);
    }

    @Transactional
    public MilestoneResponse editPublished(Long projectId, Long teamId, UUID id, MilestoneMetadataRequest request) {
        Milestone value = require(projectId, teamId, id); checkVersion(value, request.expectedVersion());
        if (request.rubricSnapshotId() != null) throw new MilestoneConflictException("Rubric cannot change after publishing");
        if (value.getStatus() != MilestoneStatus.OPEN || value.getExecutionStatus() == com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.DONE
                || value.getExecutionStatus() == com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.FAILED)
            throw new MilestoneConflictException("Milestone definition is locked");
        if (request.title() == null || request.title().isBlank() || request.deadline() == null)
            throw new MilestoneValidationException(Map.of("metadata", List.of("Title and deadline are required")));
        Instant before = value.getDeadline(); UUID actor = actors.requireCurrentActorId(); Instant now = milestoneClock.instant();
        if (!request.deadline().isAfter(now) || (value.getLateUntil() != null && !value.getLateUntil().isAfter(request.deadline())))
            throw new MilestoneValidationException(Map.of("deadline", List.of("Deadline must be future and before the late policy cutoff")));
        value.editPublishedMetadata(request.title().trim(), request.description(), request.deadline(), actor, now);
        milestones.saveAndFlush(value);
        audit(value, actor, "MILESTONE_METADATA_UPDATED", "{\"deadlineBefore\":\"" + before + "\",\"deadlineAfter\":\"" + request.deadline() + "\"}", now);
        return mapper.toResponse(value);
    }

    @Transactional
    public void deleteDraft(Long projectId, Long teamId, UUID id, long expectedVersion) {
        Milestone value = require(projectId, teamId, id); checkVersion(value, expectedVersion);
        if (value.getStatus() != MilestoneStatus.PLANNED || submissions.existsByMilestoneIdAndTeamId(id, value.getTeamId())
                || artifactDrafts.existsByMilestoneId(id) || backlogs.existsByMilestone_Id(id))
            throw new MilestoneConflictException("Only a draft without dependencies can be deleted");
        UUID actor = actors.requireCurrentActorId(); Instant now = milestoneClock.instant();
        value.softDelete(actor, now); milestones.saveAndFlush(value);
        audit(value, actor, "MILESTONE_DRAFT_DELETED", "{}", now);
    }

    private Milestone require(Long projectId, Long teamId, UUID id) {
        Long tenant = tenants.requireCurrentTenantId(); UUID actor = actors.requireCurrentActorId();
        if (projectId != null) access.requireReadAccess(projects.requireProjectForRead(projectId, actor, tenant));
        else scopes.requireTeamScope(null, teamId, tenant);
        return (projectId != null ? milestones.findByIdAndProjectIdAndTenantId(id, projectId, tenant)
                : milestones.findByIdAndTeamIdAndTenantId(id, teamId, tenant))
                .filter(Milestone::isActive).orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
    }
    private void checkVersion(Milestone value, Long expected) {
        if (expected == null || value.getVersion() != expected) throw new MilestoneConflictException("Milestone changed; reload and retry");
    }
    private void audit(Milestone value, UUID actor, String action, String details, Instant now) {
        audits.save(MilestoneAuditLog.statusEvent(value.getId(), value.getProjectId(), value.getTenantId(), actor,
                action, CorrelationIdFilter.currentId(), details, now));
    }
}
