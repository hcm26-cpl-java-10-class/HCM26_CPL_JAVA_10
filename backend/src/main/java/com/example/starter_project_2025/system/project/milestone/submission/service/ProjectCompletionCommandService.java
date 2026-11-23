package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.system.project.milestone.submission.domain.ProjectCompletionAudit;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort;
import com.example.starter_project_2025.system.project.milestone.submission.repository.ProjectCompletionAuditRepository;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.example.starter_project_2025.system.project.milestone.submission.domain.FinalProjectGrade;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneWaiver;
import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import com.example.starter_project_2025.system.project.milestone.submission.repository.FinalProjectGradeRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneWaiverRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectCompletionCommandService {
    private final FinalProjectGradeRepository grades;
    private final MilestoneWaiverRepository waivers;
    private final MilestoneRepository milestones;
    private final ProjectCompletionService completionService;
    private final MilestoneTenantProvider tenantProvider;
    private final CurrentActorProvider actorProvider;
    private final Clock milestoneClock;
    private final ProjectCompletionPort completionPort;
    private final ProjectCompletionAuditRepository audits;
    private final ProjectCompletionReadiness readiness;

    /**
     * Locks the final grade and completes the project in one transaction. Only allowed when every mandatory
     * milestone is accepted or waived and every active child project is completed; a parent project is never
     * completed implicitly, it has to be finalized on its own. Repeating the call with the same score is a no-op.
     */
    @Transactional
    public SubmissionDtos.ProjectCompletionResult finalizeProject(
            Long projectId, Long teamId, SubmissionDtos.FinalizeProjectRequest request) {
        Long tenantId = tenantProvider.requireCurrentTenantId();
        UUID actorId = actorProvider.requireCurrentActorId();
        completionPort.requireManagement(projectId, tenantId, teamId);
        completionPort.lockHierarchy(projectId, tenantId, teamId);
        var now = milestoneClock.instant();
        BigDecimal score = request.finalScore().setScale(2, RoundingMode.HALF_UP);
        var previous = grades.findByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId)
                .filter(FinalProjectGrade::isLocked);
        if (completionPort.isCompleted(projectId, tenantId)) {
            if (previous.map(grade -> grade.getFinalScore().compareTo(score) == 0).orElse(false))
                return new SubmissionDtos.ProjectCompletionResult(projectId, teamId, true, true, "ALREADY_FINALIZED");
            throw new MilestoneConflictException("The project is already completed and its final grade is locked");
        }
        var readinessResult = readiness.evaluate(tenantId, projectId, teamId);
        if (!readinessResult.ready()) throw new ProjectNotReadyException(notReadyMessage(readinessResult));
        if (previous.isPresent() && previous.get().getFinalScore().compareTo(score) != 0)
            throw new MilestoneConflictException("The final grade is already locked at "
                    + previous.get().getFinalScore().toPlainString() + " and requires an authorized adjustment to change");
        FinalProjectGrade grade = grades.findByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId)
                .orElseGet(() -> FinalProjectGrade.locked(tenantId, projectId, teamId, score, actorId, now));
        if (!grade.isLocked()) grade.lock(score, actorId, now);
        grades.saveAndFlush(grade);
        if (!completionService.reevaluate(tenantId, projectId, teamId, actorId, now))
            throw new MilestoneConflictException("The project could not be completed. Reload it and try again");
        audits.save(new ProjectCompletionAudit(tenantId, projectId, teamId, actorId, "PROJECT_FINALIZED",
                auditDetail(score, request.note()), now, CorrelationIdFilter.currentId()));
        return new SubmissionDtos.ProjectCompletionResult(projectId, teamId, true, true, "PROJECT_FINALIZED");
    }

    /** @deprecated kept for existing clients; locking the grade now finalizes the project under the same rules. */
    @Deprecated
    @Transactional
    public SubmissionDtos.ProjectCompletionResult lockFinalGrade(
            Long projectId, Long teamId, SubmissionDtos.LockFinalGradeRequest request) {
        return finalizeProject(projectId, teamId, new SubmissionDtos.FinalizeProjectRequest(request.finalScore(), null));
    }

    private static String notReadyMessage(ProjectCompletionReadiness.Result result) {
        return switch (result.readiness()) {
            case MILESTONES_PENDING -> result.pendingMilestones().size()
                    + " mandatory milestone(s) are not accepted or waived yet";
            case CHILDREN_PENDING -> result.pendingChildren().size() + " child project(s) are not completed yet";
            default -> "Only an active project can be finalized";
        };
    }

    private static String auditDetail(BigDecimal score, String note) {
        String detail = note == null || note.isBlank() ? score.toPlainString() : score.toPlainString() + " | " + note.trim();
        return detail.length() > 500 ? detail.substring(0, 500) : detail;
    }

    @Transactional
    public SubmissionDtos.ProjectCompletionResult waive(
            Long projectId, Long teamId, UUID milestoneId, SubmissionDtos.WaiveMilestoneRequest request) {
        Long tenantId = tenantProvider.requireCurrentTenantId();
        completionPort.requireManagement(projectId, tenantId, teamId);
        completionPort.lockHierarchy(projectId, tenantId, teamId);
        if (!completionPort.isActive(projectId, tenantId))
            throw new MilestoneConflictException("Only an active project can receive a milestone waiver");
        var milestone = milestones.findByIdAndProjectIdAndTenantId(milestoneId, projectId, tenantId)
                .filter(value -> java.util.Objects.equals(teamId, value.getTeamId()))
                .orElseThrow(() -> new ResourceNotFoundException("Milestone does not exist or has changed"));
        if (!milestone.isActive() || milestone.getStatus() != MilestoneStatus.OPEN)
            throw new MilestoneConflictException(
                    "Only a published milestone can be waived");
        UUID actorId = actorProvider.requireCurrentActorId();
        var now = milestoneClock.instant();
        if (waivers.findByTenantIdAndMilestone_IdAndTeamId(tenantId, milestoneId, teamId).isEmpty()) {
            waivers.save(MilestoneWaiver.create(tenantId, projectId, milestone, teamId, request.reason(), actorId, now));
            audits.save(new ProjectCompletionAudit(
                    tenantId, projectId, teamId, actorId, "MILESTONE_WAIVED", request.reason(), now,
                    CorrelationIdFilter.currentId()));
        }
        waivers.flush();
        boolean completed = completionService.reevaluate(tenantId, projectId, teamId, actorId, now);
        boolean gradeLocked = grades.findByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId)
                .map(FinalProjectGrade::isLocked).orElse(false);
        return new SubmissionDtos.ProjectCompletionResult(projectId, teamId, completed, gradeLocked, "MILESTONE_WAIVED");
    }
}
