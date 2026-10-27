package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
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

    @Transactional
    public SubmissionDtos.ProjectCompletionResult lockFinalGrade(
            Long projectId, Long teamId, SubmissionDtos.LockFinalGradeRequest request) {
        Long tenantId = tenantProvider.requireCurrentTenantId();
        UUID actorId = actorProvider.requireCurrentActorId();
        var now = milestoneClock.instant();
        FinalProjectGrade grade = grades.findByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId)
                .orElseGet(() -> FinalProjectGrade.locked(tenantId, projectId, teamId,
                        request.finalScore(), actorId, now));
        grade.lock(request.finalScore(), actorId, now);
        grades.saveAndFlush(grade);
        boolean completed = completionService.reevaluate(tenantId, projectId, teamId, actorId, now);
        return new SubmissionDtos.ProjectCompletionResult(projectId, teamId, completed, true, "GRADE_LOCKED");
    }

    @Transactional
    public SubmissionDtos.ProjectCompletionResult waive(
            Long projectId, Long teamId, UUID milestoneId, SubmissionDtos.WaiveMilestoneRequest request) {
        Long tenantId = tenantProvider.requireCurrentTenantId();
        var milestone = milestones.findByIdAndProjectIdAndTenantId(milestoneId, projectId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone does not exist or has changed"));
        UUID actorId = actorProvider.requireCurrentActorId();
        var now = milestoneClock.instant();
        waivers.findByTenantIdAndMilestoneIdAndTeamId(tenantId, milestoneId, teamId)
                .orElseGet(() -> waivers.save(MilestoneWaiver.create(tenantId, projectId,
                        milestone.getId(), teamId, request.reason(), actorId, now)));
        waivers.flush();
        boolean completed = completionService.reevaluate(tenantId, projectId, teamId, actorId, now);
        boolean gradeLocked = grades.findByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId)
                .map(FinalProjectGrade::isLocked).orElse(false);
        return new SubmissionDtos.ProjectCompletionResult(projectId, teamId, completed, gradeLocked, "MILESTONE_WAIVED");
    }
}
