package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort;
import com.example.starter_project_2025.system.project.milestone.submission.repository.*;
import com.example.starter_project_2025.system.project.milestone.submission.service.SubmissionVersionService;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.service.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MasterMilestoneService {
    public record Item(UUID id, String title, String description, Instant deadline, boolean mandatory,
                       String status, boolean waived, UUID submissionId, boolean canSubmit) { }
    public record Context(Long projectId, String projectName, AssignmentDtos.Mode mode, Long teamId,
                          String status, boolean canManage, boolean readOnly, List<Item> milestones) { }
    public record Submit(@NotBlank @Size(max = 1000) String evidenceUrl,
                         @Size(max = 2000) String notes) { }

    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceProjectScope workspaceScope;
    private final ProjectAssignmentRepository assignments;
    private final ProjectRepository projects;
    private final MasterProjectAccess masterAccess;
    private final MilestoneRepository milestones;
    private final MilestoneSubmissionRepository submissions;
    private final SubmissionVersionRepository versions;
    private final MilestoneWaiverRepository waivers;
    private final SubmissionVersionService submissionCommands;
    private final ProjectCompletionPort completion;
    private final CurrentActorProvider actors;
    private final Clock milestoneClock;

    public Context get(Long workspaceId) {
        Workspace workspace = contexts.require(access.requireUser(false), workspaceId);
        Project master = master(workspace);
        if (master == null) return null;
        return context(master, workspaceScope.readOnly(workspace));
    }

    public Context getForClass(Long projectId) {
        return context(masterAccess.requireManagement(projectId), false);
    }

    private Context context(Project master, boolean historicalWorkspace) {
        var assignment = assignments.findById(master.getAssignmentId()).orElseThrow();
        boolean readOnly = historicalWorkspace || master.getStatus() != ProjectStatus.ACTIVE;
        boolean canManage = assignment.getMode() == AssignmentDtos.Mode.SPLIT && masterAccess.canManage(master.getId());
        var waived = waivers.findAllByTenantIdAndProjectIdAndTeamId(master.getTenantId(), master.getId(), master.getTeamId())
                .stream().map(MilestoneWaiver::getMilestoneId).collect(java.util.stream.Collectors.toSet());
        var items = milestones.findAllByProjectIdAndTenantId(master.getId(), master.getTenantId(), Pageable.unpaged())
                .stream().filter(value -> value.isActive() && value.getStatus() != MilestoneStatus.PLANNED)
                .sorted(Comparator.comparing(Milestone::getDeadline, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(value -> {
                    var submission = submissions.findByMilestoneIdAndTeamId(value.getId(), master.getTeamId());
                    return new Item(value.getId(), value.getTitle(), value.getDescription(), value.getDeadline(), value.isMandatory(),
                            value.lifecycleStatus().name(), waived.contains(value.getId()),
                            canManage ? submission.map(MilestoneSubmission::getId).orElse(null) : null,
                            canManage && !readOnly && !waived.contains(value.getId()) && canSubmit(value, submission.orElse(null)));
                }).toList();
        return new Context(master.getId(), master.getName(), assignment.getMode(), master.getTeamId(),
                master.getStatus().name(), canManage, readOnly, items);
    }

    @Transactional
    public SubmissionDtos.Detail submit(Long workspaceId, UUID milestoneId, String key, Submit request) {
        Workspace workspace = contexts.require(access.requireUser(false), workspaceId);
        Project master = master(workspace);
        if (master == null || workspaceScope.readOnly(workspace)) throw new AccessDeniedException("This workspace is read-only");
        masterAccess.requireManagement(master.getId());
        return submit(master, milestoneId, key, request);
    }

    @Transactional
    public SubmissionDtos.Detail submitForClass(Long projectId, UUID milestoneId, String key, Submit request) {
        return submit(masterAccess.requireManagement(projectId), milestoneId, key, request);
    }

    private SubmissionDtos.Detail submit(Project master, UUID milestoneId, String key, Submit request) {
        completion.lockHierarchy(master.getId(), master.getTenantId(), master.getTeamId());
        if (master.getStatus() != ProjectStatus.ACTIVE) throw new MilestoneConflictException("The master project is closed");
        if (key == null || key.isBlank() || key.length() > 100) throw AssignmentException.invalid("Provide a submission request key");
        validateUrl(request.evidenceUrl());
        Milestone milestone = milestones.findByIdAndProjectIdAndTenantId(milestoneId, master.getId(), master.getTenantId())
                .filter(value -> value.isActive() && Objects.equals(value.getTeamId(), master.getTeamId()))
                .orElseThrow(() -> new ResourceNotFoundException("Master milestone was not found"));
        if (waivers.findByTenantIdAndMilestoneIdAndTeamId(master.getTenantId(), milestoneId, master.getTeamId()).isPresent())
            throw new MilestoneConflictException("This master milestone has already been waived");
        var existing = submissions.findByMilestoneIdAndTeamId(milestoneId, master.getTeamId());
        if (existing.isPresent() && existing.get().getStatus() != SubmissionStatus.DRAFT
                && existing.get().getStatus() != SubmissionStatus.CHANGES_REQUESTED)
            return submissionCommands.submit(existing.get().getId(), key);
        if (!canSubmit(milestone, existing.orElse(null)))
            throw new MilestoneConflictException("The master milestone is outside its submission window or attempt limit");
        UUID actor = actors.requireCurrentActorId();
        Instant now = milestoneClock.instant();
        var user = access.requireUser(false);
        String actorName = (user.getFirstName() + " " + user.getLastName()).trim();
        if (milestone.lifecycleStatus() == MilestoneLifecycleStatus.PLANNED) milestone.start(actor, now);
        var artifact = new SubmissionDtos.ArtifactRequest(SubmissionArtifactType.DOCUMENTATION, "Shared master evidence", request.evidenceUrl().trim());
        MilestoneSubmission submission;
        if (existing.isEmpty()) {
            submission = MilestoneSubmission.create(milestone, master.getTeamId(), "Class master project", actor, actorName, actor, actorName, now);
            submissions.saveAndFlush(submission);
            var version = SubmissionVersion.draft(submission, 1, milestone.getTitle(), request.notes(), request.evidenceUrl().trim(), actor, now);
            version.replaceArtifacts(List.of(new SubmissionVersion.ArtifactValue(artifact.type(), artifact.name(), artifact.url())));
            version.replaceChecklist(milestone.getChecklistItems().stream().map(value ->
                    new SubmissionVersion.ChecklistValue(value.getId(), value.getContent(), value.isMandatory(), false, null)).toList());
            versions.saveAndFlush(version);
        } else {
            submission = existing.get();
            if (submission.getStatus() == SubmissionStatus.CHANGES_REQUESTED)
                submissionCommands.createNextVersion(submission.getId(), new SubmissionDtos.CreateVersionRequest(
                        milestone.getTitle(), request.notes(), request.evidenceUrl().trim(), List.of(artifact)));
            else {
                var version = versions.findBySubmissionIdAndVersionNumber(submission.getId(), submission.getCurrentVersionNumber()).orElseThrow();
                submissionCommands.updateDraft(submission.getId(), version.getId(), new SubmissionDtos.UpdateDraftRequest(
                        milestone.getTitle(), request.notes(), request.evidenceUrl().trim(), List.of(artifact)));
            }
        }
        return submissionCommands.submit(submission.getId(), key);
    }

    private Project master(Workspace workspace) {
        Project primary = workspace.getProject();
        if (primary == null || primary.getAssignmentId() == null) return null;
        var assignment = assignments.findById(primary.getAssignmentId())
                .filter(value -> Objects.equals(value.getTenantId(), workspace.getTenant().getId())
                        && Objects.equals(value.getClassId(), workspace.getTeam().getTrainingClass().getId()))
                .orElseThrow(() -> new AccessDeniedException("Invalid master project scope"));
        return projects.findById(assignment.getMasterProjectId())
                .filter(value -> Boolean.TRUE.equals(value.getIsActive())
                        && Objects.equals(value.getAssignmentId(), assignment.getId())
                        && Objects.equals(value.getTenantId(), assignment.getTenantId()))
                .orElseThrow(() -> new AccessDeniedException("Master project is outside this workspace"));
    }

    private boolean canSubmit(Milestone milestone, MilestoneSubmission submission) {
        var state = milestone.lifecycleStatus();
        if (milestone.getStatus() != MilestoneStatus.OPEN || !Set.of(MilestoneLifecycleStatus.PLANNED,
                MilestoneLifecycleStatus.IN_PROGRESS, MilestoneLifecycleStatus.CHANGES_REQUESTED).contains(state)) return false;
        Instant cutoff = milestone.getLatePolicyType() == LatePolicyType.ALLOW_LATE && milestone.getLateUntil() != null
                ? milestone.getLateUntil() : milestone.getDeadline();
        if (cutoff != null && milestoneClock.instant().isAfter(cutoff)) return false;
        return submission == null || submission.getStatus() == SubmissionStatus.DRAFT
                || submission.getStatus() == SubmissionStatus.CHANGES_REQUESTED && milestone.isAllowResubmission()
                && (milestone.getMaxSubmissionAttempts() == null || submission.getSubmissionAttempts() < milestone.getMaxSubmissionAttempts());
    }

    private void validateUrl(String value) {
        try {
            URI url = URI.create(value.trim());
            if (!Set.of("https", "http").contains(url.getScheme()) || url.getHost() == null || url.getUserInfo() != null)
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException invalid) { throw AssignmentException.invalid("Enter a valid HTTP or HTTPS evidence link"); }
    }
}
