package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.system.project.milestone.submission.domain.FinalProjectGrade;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneWaiver;
import com.example.starter_project_2025.system.project.milestone.submission.repository.FinalProjectGradeRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneWaiverRepository;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort.ChildCompletion;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort.CompletionTarget;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectCompletionService {
    private final MilestoneRepository milestones;
    private final ProjectCompletionPort completionPort;
    private final FinalProjectGradeRepository grades;
    private final MilestoneWaiverRepository waivers;

    @Transactional
    public boolean reevaluate(Long tenantId, Long projectId, Long teamId, UUID actorId, Instant now) {
        boolean completed = false;
        for (var target : completionPort.lockHierarchy(projectId, tenantId, teamId)) {
            if (!completionPort.isActive(target.projectId(), tenantId)) break;
            var children = completionPort.childCompletion(target.projectId(), tenantId);
            if (children == ChildCompletion.PENDING) break;
            if (!requirementsSatisfied(tenantId, target, children)) break;
            if (!completionPort.complete(target.projectId(), tenantId, target.teamId(), actorId, now)) break;
            if (target.projectId().equals(projectId)) completed = true;
        }
        return completed;
    }

    private boolean requirementsSatisfied(Long tenantId, CompletionTarget target, ChildCompletion children) {
        var active = milestones.findAllByProjectIdAndTenantId(target.projectId(), tenantId, Pageable.unpaged()).stream()
                .filter(item -> item.isActive() && java.util.Objects.equals(target.teamId(), item.getTeamId())).toList();
        boolean gradeLocked = grades.findByTenantIdAndProjectIdAndTeamId(tenantId, target.projectId(), target.teamId())
                .map(FinalProjectGrade::isLocked).orElse(false);
        if (!gradeLocked) return false;
        var waived = waivers.findAllByTenantIdAndProjectIdAndTeamId(tenantId, target.projectId(), target.teamId()).stream()
                .map(MilestoneWaiver::getMilestoneId).collect(java.util.stream.Collectors.toSet());
        return active.stream().filter(Milestone::isMandatory)
                .allMatch(item -> item.lifecycleStatus() == MilestoneLifecycleStatus.ACCEPTED || waived.contains(item.getId()));
    }

    public void requireActive(Long tenantId, Long projectId) {
        if (!completionPort.isActive(projectId, tenantId))
            throw new MilestoneConflictException("The project is closed and its assessment is read-only");
    }
}
