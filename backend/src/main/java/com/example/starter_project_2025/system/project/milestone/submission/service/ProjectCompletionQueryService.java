package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.FinalProjectGrade;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneWaiver;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort;
import com.example.starter_project_2025.system.project.milestone.submission.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectCompletionQueryService {
    public record Milestone(UUID id, String title, boolean mandatory, boolean accepted, boolean waived) { }
    public record Summary(Long projectId, Long teamId, boolean completed, boolean gradeLocked, BigDecimal finalScore,
                          boolean canManage, boolean childrenCompleted, List<Milestone> milestones) { }

    private final ProjectCompletionPort port;
    private final MilestoneTenantProvider tenantProvider;
    private final FinalProjectGradeRepository grades;
    private final MilestoneWaiverRepository waivers;
    private final MilestoneRepository milestones;
    private final ProjectRepository projects;

    public Summary get(Long projectId, Long teamId) {
        Long tenantId = tenantProvider.requireCurrentTenantId();
        port.requireRead(projectId, tenantId, teamId);
        boolean canManage;
        try { port.requireManagement(projectId, tenantId, teamId); canManage = true; }
        catch (AccessDeniedException denied) { canManage = false; }
        boolean manage = canManage;
        var grade = grades.findByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId);
        var waived = waivers.findAllByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId).stream()
                .map(MilestoneWaiver::getMilestoneId).collect(Collectors.toSet());
        List<Milestone> rows = milestones.findAllByProjectIdAndTenantId(projectId, tenantId, Pageable.unpaged()).stream()
                .filter(item -> item.isActive() && java.util.Objects.equals(teamId, item.getTeamId()) && (manage || item.getStatus() != MilestoneStatus.PLANNED))
                .map(item -> new Milestone(item.getId(), item.getTitle(), item.isMandatory(),
                        item.lifecycleStatus() == MilestoneLifecycleStatus.ACCEPTED, waived.contains(item.getId()))).toList();
        boolean childrenCompleted = projects.findAllByParentProject_IdAndIsActiveTrueOrderByIdAsc(projectId).stream()
                .allMatch(child -> tenantId.equals(child.getTenantId()) && child.getStatus() == ProjectStatus.COMPLETED);
        return new Summary(projectId, teamId, port.isCompleted(projectId, tenantId), grade.map(FinalProjectGrade::isLocked).orElse(false),
                canManage ? grade.map(FinalProjectGrade::getFinalScore).orElse(null) : null, canManage, childrenCompleted, rows);
    }
}
