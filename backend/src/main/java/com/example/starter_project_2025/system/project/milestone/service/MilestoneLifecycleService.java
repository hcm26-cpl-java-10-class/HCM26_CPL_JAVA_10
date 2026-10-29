package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.audit.*;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.dto.request.*;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneResponse;
import com.example.starter_project_2025.system.project.milestone.exception.*;
import com.example.starter_project_2025.system.project.milestone.integration.port.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneDraftRevisionRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class MilestoneLifecycleService {
    private final MilestoneRepository milestones;
    private final MilestoneDraftRevisionRepository revisions;
    private final ObjectMapper objectMapper;
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
        value.configureAutoStart(request.deadlineOffsetDays(), false);
        if (request.checklist() != null) value.replaceChecklist(request.checklist());
        milestones.saveAndFlush(value);
        captureRevision(value, 1, actor, now);
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
        var history = revisions.findByMilestoneIdAndTenantIdOrderByRevisionNumberDesc(id, value.getTenantId());
        if (history.isEmpty()) captureRevision(value, 1, value.getUpdatedBy() == null ? actor : value.getUpdatedBy(), value.getUpdatedAt());
        value.editDraft(request.title().trim(), request.description(), request.deadline(), Boolean.TRUE.equals(request.mandatory()),
                request.rubricSnapshotId(), request.latePolicyType(), request.lateUntil(), request.latePenaltyPercent(),
                request.weight(), actor, now);
        value.replaceChecklist(request.checklist());
        value.configureResubmission(Boolean.TRUE.equals(request.allowResubmission()), request.maxSubmissionAttempts());
        value.configureAutoStart(request.deadlineOffsetDays(), false);
        milestones.saveAndFlush(value);
        captureRevision(value, history.isEmpty() ? 2 : history.getFirst().getRevisionNumber() + 1, actor, now);
        audit(value, actor, "MILESTONE_DRAFT_UPDATED", "{}", now);
        return mapper.toResponse(value);
    }

    @Transactional
    public MilestoneResponse publish(Long projectId, Long teamId, UUID id, long expectedVersion) {
        Milestone value = require(projectId, teamId, id);
        checkVersion(value, expectedVersion);
        if (value.getStatus() != MilestoneStatus.PLANNED)
            throw new MilestoneConflictException("Only unpublished planned milestones can be published");
        Map<String, List<String>> missing = new LinkedHashMap<>();
        if (value.getDeadline() == null || !value.getDeadline().isAfter(milestoneClock.instant()))
            missing.put("deadline", List.of("A future deadline is required"));
        if (value.getRubricSnapshotId() == null) missing.put("rubricSnapshotId", List.of("Rubric is required"));
        if (value.getLatePolicyType() == null) missing.put("latePolicy", List.of("Late policy is required"));
        if (value.getChecklistItems().isEmpty()) missing.put("checklist", List.of("Checklist is required"));
        if (!missing.isEmpty()) throw new MilestoneValidationException(missing);
        UUID actor = actors.requireCurrentActorId(); Instant now = milestoneClock.instant();
        rubrics.requireAllowedSnapshot(value.getRubricSnapshotId(), value.getProjectId(), actor, value.getTenantId());
        value.configureAutoStart(value.getDeadlineOffsetDays(), value.getDeadlineOffsetDays() != null);
        value.openForWork(actor, now);
        value.startAutomatically(now);
        milestones.saveAndFlush(value);
        audit(value, actor, value.lifecycleStatus() == MilestoneLifecycleStatus.IN_PROGRESS
                ? "MILESTONE_AUTO_STARTED" : "MILESTONE_PUBLISHED", "{}", now);
        if (value.lifecycleStatus() == MilestoneLifecycleStatus.IN_PROGRESS) outbox.writeMilestoneStarted(value, now);
        else outbox.writeMilestoneOpened(value, now);
        return mapper.toResponse(value);
    }

    @Transactional
    public MilestoneResponse start(Long projectId, Long teamId, UUID id, long expectedVersion) {
        Milestone value = require(projectId, teamId, id); checkVersion(value, expectedVersion);
        if (value.getStatus() != MilestoneStatus.OPEN || value.lifecycleStatus() != MilestoneLifecycleStatus.PLANNED)
            throw new MilestoneConflictException("Only a published planned milestone can start");
        UUID actor = actors.requireCurrentActorId(); Instant now = milestoneClock.instant();
        value.start(actor, now);
        milestones.saveAndFlush(value);
        audit(value, actor, "MILESTONE_STARTED", "{}", now);
        outbox.writeMilestoneStarted(value, now);
        return mapper.toResponse(value);
    }

    @Transactional
    public MilestoneResponse open(Long projectId, Long teamId, UUID id) {
        Milestone value = require(projectId, teamId, id);
        if (value.getStatus() == MilestoneStatus.OPEN) return mapper.toResponse(value);
        return publish(projectId, teamId, id, value.getVersion());
    }

    @Transactional
    public MilestoneResponse editActive(Long projectId, Long teamId, UUID id, MilestoneLifecycleEditRequest request) {
        Milestone value = require(projectId, teamId, id); checkVersion(value, request.expectedVersion());
        MilestoneLifecycleStatus state = value.lifecycleStatus();
        if (state != MilestoneLifecycleStatus.IN_PROGRESS && state != MilestoneLifecycleStatus.CHANGES_REQUESTED)
            throw new MilestoneConflictException("Milestone cannot be edited in " + state);
        if (request.deadline() == null)
            throw new MilestoneValidationException(Map.of("deadline", List.of("Deadline is required")));
        if (request.deadline().isBefore(value.getDeadline()))
            throw new MilestoneValidationException(Map.of("deadline", List.of("Deadline cannot be shortened after start")));
        boolean extended = request.deadline().isAfter(value.getDeadline());
        if (extended && !request.deadline().isAfter(milestoneClock.instant()))
            throw new MilestoneValidationException(Map.of("deadline", List.of("Extended deadline must be in the future")));
        if (state == MilestoneLifecycleStatus.CHANGES_REQUESTED && request.description() != null
                && !request.description().equals(value.getDescription()))
            throw new MilestoneConflictException("Only the resubmission deadline can change");
        if (!extended && (state == MilestoneLifecycleStatus.CHANGES_REQUESTED
                || request.description() == null || request.description().equals(value.getDescription())))
            throw new MilestoneValidationException(Map.of("deadline", List.of("Extend the deadline or change the description")));
        if (request.description() != null && request.description().length() > 1000)
            throw new MilestoneValidationException(Map.of("description", List.of("Maximum 1000 characters")));
        UUID actor = actors.requireCurrentActorId(); Instant now = milestoneClock.instant();
        var history = revisions.findByMilestoneIdAndTenantIdOrderByRevisionNumberDesc(id, value.getTenantId());
        if (history.isEmpty()) captureRevision(value, 1, actor, now);
        if (state == MilestoneLifecycleStatus.IN_PROGRESS)
            value.editActive(request.description(), request.deadline(), actor, now);
        else value.extendResubmission(request.deadline(), actor, now);
        milestones.saveAndFlush(value);
        captureRevision(value, history.isEmpty() ? 2 : history.getFirst().getRevisionNumber() + 1, actor, now);
        audit(value, actor, "MILESTONE_UPDATED", "{\"state\":\"" + state + "\"}", now);
        return mapper.toResponse(value);
    }

    @Transactional
    public void deleteDraft(Long projectId, Long teamId, UUID id, long expectedVersion) {
        Milestone value = require(projectId, teamId, id); checkVersion(value, expectedVersion);
        if (value.lifecycleStatus() != MilestoneLifecycleStatus.PLANNED
                && value.lifecycleStatus() != MilestoneLifecycleStatus.IN_PROGRESS)
            throw new MilestoneConflictException("Only planned or in-progress milestones can be deleted");
        if (value.getStatus() == MilestoneStatus.PLANNED && (submissions.existsByMilestoneIdAndTeamId(id, value.getTeamId())
                || artifactDrafts.existsByMilestoneId(id) || backlogs.existsByMilestone_Id(id)))
            throw new MilestoneConflictException("A planned milestone with dependencies cannot be deleted");
        if (value.lifecycleStatus() == MilestoneLifecycleStatus.IN_PROGRESS
                && submissions.existsByMilestoneIdAndTeamId(id, value.getTeamId()))
            throw new MilestoneConflictException("A milestone with submission records cannot be deleted");
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
    public void recordInitialRevision(Milestone milestone, UUID actor, Instant now) {
        captureRevision(milestone, 1, actor, now);
    }
    @Transactional(readOnly = true)
    public List<MilestoneDraftRevision> listDraftRevisions(Long projectId, Long teamId, UUID id) {
        Milestone value = require(projectId, teamId, id);
        return revisions.findByMilestoneIdAndTenantIdOrderByRevisionNumberDesc(value.getId(), value.getTenantId());
    }
    private void captureRevision(Milestone value, int number, UUID actor, Instant now) {
        var snapshot = Map.ofEntries(
                Map.entry("title", value.getTitle()),
                Map.entry("lifecycleStatus", value.lifecycleStatus().name()),
                Map.entry("description", value.getDescription() == null ? "" : value.getDescription()),
                Map.entry("mandatory", value.isMandatory()),
                Map.entry("checklist", value.getChecklistItems().stream().map(item -> Map.of(
                        "content", item.getContent(), "mandatory", item.isMandatory(), "orderIndex", item.getOrderIndex())).toList()),
                Map.entry("allowResubmission", value.isAllowResubmission()),
                Map.entry("maxSubmissionAttempts", value.getMaxSubmissionAttempts() == null ? 0 : value.getMaxSubmissionAttempts()),
                Map.entry("weight", value.getWeight() == null ? "" : value.getWeight().toPlainString()),
                Map.entry("deadline", value.getDeadline() == null ? "" : value.getDeadline().toString()),
                Map.entry("deadlineOffsetDays", value.getDeadlineOffsetDays() == null ? 0 : value.getDeadlineOffsetDays()),
                Map.entry("rubricSnapshotId", value.getRubricSnapshotId() == null ? "" : value.getRubricSnapshotId().toString()),
                Map.entry("latePolicyType", value.getLatePolicyType() == null ? "" : value.getLatePolicyType().name()),
                Map.entry("lateUntil", value.getLateUntil() == null ? "" : value.getLateUntil().toString()),
                Map.entry("latePenaltyPercent", value.getLatePenaltyPercent() == null ? "" : value.getLatePenaltyPercent().toPlainString()));
        try {
            revisions.save(MilestoneDraftRevision.capture(value, number,
                    objectMapper.writeValueAsString(snapshot), actor, now));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to save milestone draft revision", exception);
        }
    }
    private void audit(Milestone value, UUID actor, String action, String details, Instant now) {
        audits.save(MilestoneAuditLog.statusEvent(value.getId(), value.getProjectId(), value.getTenantId(), actor,
                action, CorrelationIdFilter.currentId(), details, now));
    }
}
