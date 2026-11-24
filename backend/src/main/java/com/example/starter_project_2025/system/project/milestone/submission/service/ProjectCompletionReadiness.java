package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneWaiver;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneWaiverRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Decides whether a project (module or master) can be finalized. It is the single source of truth for the
 * finalize button and for the guarded finalize command, and it never filters by the viewer's role so every
 * viewer sees the same readiness. It does not check access; callers do.
 */
@Component
@RequiredArgsConstructor
public class ProjectCompletionReadiness {
    public enum Readiness { INACTIVE, MILESTONES_PENDING, CHILDREN_PENDING, READY, COMPLETED }

    public record PendingMilestone(UUID id, String title, String lifecycleStatus, boolean draft) { }

    public record PendingChild(Long id, String code, String name, String status) { }

    public record Result(Readiness readiness, List<PendingMilestone> pendingMilestones,
                         List<PendingChild> pendingChildren) {
        public boolean ready() { return readiness == Readiness.READY; }
    }

    private final MilestoneRepository milestones;
    private final MilestoneWaiverRepository waivers;
    private final ProjectRepository projects;
    private final ProjectCompletionPort completionPort;

    public Result evaluate(Long tenantId, Long projectId, Long teamId) {
        if (completionPort.isCompleted(projectId, tenantId))
            return new Result(Readiness.COMPLETED, List.of(), List.of());
        List<PendingMilestone> pendingMilestones = pendingMandatoryMilestones(tenantId, projectId, teamId);
        List<PendingChild> pendingChildren = pendingChildren(tenantId, projectId);
        Readiness readiness = !completionPort.isActive(projectId, tenantId) ? Readiness.INACTIVE
                : !pendingMilestones.isEmpty() ? Readiness.MILESTONES_PENDING
                : !pendingChildren.isEmpty() ? Readiness.CHILDREN_PENDING
                : Readiness.READY;
        return new Result(readiness, pendingMilestones, pendingChildren);
    }

    /** Mandatory, active milestones of the project/team pair that are neither accepted nor waived. */
    public List<PendingMilestone> pendingMandatoryMilestones(Long tenantId, Long projectId, Long teamId) {
        Set<UUID> waived = waivedMilestoneIds(tenantId, projectId, teamId);
        return milestones.findAllByProjectIdAndTenantId(projectId, tenantId, Pageable.unpaged()).stream()
                .filter(item -> item.isActive() && item.isMandatory() && Objects.equals(teamId, item.getTeamId()))
                .filter(item -> item.lifecycleStatus() != MilestoneLifecycleStatus.ACCEPTED && !waived.contains(item.getId()))
                .map(ProjectCompletionReadiness::pending)
                .toList();
    }

    public Set<UUID> waivedMilestoneIds(Long tenantId, Long projectId, Long teamId) {
        return waivers.findAllByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId).stream()
                .map(MilestoneWaiver::getMilestoneId).collect(Collectors.toSet());
    }

    private List<PendingChild> pendingChildren(Long tenantId, Long projectId) {
        return projects.findAllByParentProject_IdAndIsActiveTrueOrderByIdAsc(projectId).stream()
                .filter(child -> tenantId.equals(child.getTenantId()) && child.getStatus() != ProjectStatus.COMPLETED)
                .map(ProjectCompletionReadiness::pending)
                .toList();
    }

    private static PendingMilestone pending(Milestone milestone) {
        return new PendingMilestone(milestone.getId(), milestone.getTitle(), milestone.lifecycleStatus().name(),
                milestone.getStatus() == MilestoneStatus.PLANNED);
    }

    private static PendingChild pending(Project child) {
        return new PendingChild(child.getId(), child.getCode(), child.getName(),
                child.getStatus() == null ? null : child.getStatus().name());
    }
}
