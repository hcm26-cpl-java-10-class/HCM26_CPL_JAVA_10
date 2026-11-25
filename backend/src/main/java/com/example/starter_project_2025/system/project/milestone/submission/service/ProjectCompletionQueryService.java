package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.FinalProjectGrade;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort;
import com.example.starter_project_2025.system.project.milestone.submission.repository.FinalProjectGradeRepository;
import com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionReadiness.PendingChild;
import com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionReadiness.PendingMilestone;
import com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionReadiness.Readiness;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectCompletionQueryService {
    public record Milestone(UUID id, String title, boolean mandatory, boolean accepted, boolean waived) { }

    /**
     * {@code readiness}/{@code canFinalize} drive the finalize button; the score fields are only filled for users
     * who can manage the project's assessment.
     */
    public record Summary(Long projectId, Long teamId, boolean completed, boolean gradeLocked, BigDecimal finalScore,
                          boolean canManage, boolean childrenCompleted, List<Milestone> milestones,
                          Readiness readiness, boolean canFinalize, boolean master,
                          List<PendingMilestone> pendingMilestones, List<PendingChild> pendingChildren,
                          BigDecimal suggestedScore, Instant finalizedAt) { }

    private final ProjectCompletionPort port;
    private final MilestoneTenantProvider tenantProvider;
    private final FinalProjectGradeRepository grades;
    private final MilestoneRepository milestones;
    private final ProjectRepository projects;
    private final ProjectCompletionReadiness readiness;
    private final ProjectFinalScoreSuggestion scoreSuggestion;

    public Summary get(Long projectId, Long teamId) {
        Long tenantId = tenantProvider.requireCurrentTenantId();
        port.requireRead(projectId, tenantId, teamId);
        boolean canManage;
        try { port.requireManagement(projectId, tenantId, teamId); canManage = true; }
        catch (AccessDeniedException denied) { canManage = false; }
        boolean manage = canManage;
        var grade = grades.findByTenantIdAndProjectIdAndTeamId(tenantId, projectId, teamId);
        var waived = readiness.waivedMilestoneIds(tenantId, projectId, teamId);
        List<Milestone> rows = milestones.findAllByProjectIdAndTenantId(projectId, tenantId, Pageable.unpaged()).stream()
                .filter(item -> item.isActive() && java.util.Objects.equals(teamId, item.getTeamId()) && (manage || item.getStatus() != MilestoneStatus.PLANNED))
                .map(item -> new Milestone(item.getId(), item.getTitle(), item.isMandatory(),
                        item.lifecycleStatus() == MilestoneLifecycleStatus.ACCEPTED, waived.contains(item.getId()))).toList();
        var result = readiness.evaluate(tenantId, projectId, teamId);
        boolean master = projects.findById(projectId).map(project -> project.getParentProject() == null).orElse(false);
        boolean scoreOpen = canManage && result.ready();
        return new Summary(projectId, teamId, result.readiness() == Readiness.COMPLETED,
                grade.map(FinalProjectGrade::isLocked).orElse(false),
                canManage ? grade.map(FinalProjectGrade::getFinalScore).orElse(null) : null, canManage,
                result.pendingChildren().isEmpty(), rows, result.readiness(), scoreOpen, master,
                result.pendingMilestones(), result.pendingChildren(),
                scoreOpen ? scoreSuggestion.suggest(tenantId, projectId, teamId, waived) : null,
                grade.map(FinalProjectGrade::getLockedAt).orElse(null));
    }
}
