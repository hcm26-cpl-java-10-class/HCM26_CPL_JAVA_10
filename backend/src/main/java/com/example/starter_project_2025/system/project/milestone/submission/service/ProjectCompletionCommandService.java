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

    @Transactional
    public SubmissionDtos.ProjectCompletionResult lockFinalGrade(
            Long projectId, Long teamId, SubmissionDtos.LockFinalGradeRequest request) {
        Long tenantId = tenantProvider.requireCurrentTenantId();
        UUID actorId = actorProvider.requireCurrentActorId();
        completionPort.requireManagement(projectId, tenantId, teamId);
        completionPort.lockHierarchy(projectId, tenantId, teamId);
        var now = milestoneClock.instant();
        var previous = grades.findByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId);
        if (previous.isEmpty() && !completionPort.isActive(projectId, tenantId))
            throw new MilestoneConflictException("Only an active project can receive its final grade");
        FinalProjectGrade grade = previous
                .orElseGet(() -> FinalProjectGrade.locked(tenantId, projectId, teamId,
                        request.finalScore(), actorId, now));
        if (grade.isLocked() && grade.getFinalScore().compareTo(request.finalScore()) != 0)
            throw new MilestoneConflictException("The final grade is locked and requires an authorized adjustment to change");
        if (!grade.isLocked()) grade.lock(request.finalScore(), actorId, now);
        grades.saveAndFlush(grade);
        if (previous.isEmpty()) audits.save(new ProjectCompletionAudit(
                tenantId, projectId, teamId, actorId, "FINAL_GRADE_LOCKED", request.finalScore().toPlainString(), now,
                CorrelationIdFilter.currentId()));
        boolean completed = completionService.reevaluate(tenantId, projectId, teamId, actorId, now)
                || completionPort.isCompleted(projectId, tenantId);
        return new SubmissionDtos.ProjectCompletionResult(projectId, teamId, completed, true, "GRADE_LOCKED");
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
        if (waivers.findByTenantIdAndMilestoneIdAndTeamId(tenantId, milestoneId, teamId).isEmpty()) {
            waivers.save(MilestoneWaiver.create(tenantId, projectId, milestone.getId(), teamId, request.reason(), actorId, now));
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
