package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Component
@Profile("!test & !milestone-mock-completion")
@RequiredArgsConstructor
public class JpaProjectCompletionAdapter implements ProjectCompletionPort {
    private final ProjectRepository projects;
    private final EntityManager entityManager;
    private final com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService access;
    private final com.example.starter_project_2025.system.project.template.assignment.hierarchy.MasterProjectAccess masterAccess;

    @Override
    public void requireRead(Long projectId, Long tenantId, Long teamId) {
        if (teamId == null) {
            masterAccess.requireClassMaster(projectId);
            return;
        }
        var user = access.requireUser(false);
        if (!Objects.equals(tenantId, user.getTenantId())) throw new org.springframework.security.access.AccessDeniedException("Project belongs to another tenant");
        access.requirePair(user, projectId, teamId, false);
    }

    @Override
    public void requireManagement(Long projectId, Long tenantId, Long teamId) {
        requireRead(projectId, tenantId, teamId);
        var user = access.requireUser(false);
        boolean author = user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && java.util.Set.of("SUPER_ADMIN", "ADMIN", "PROGRAM_MANAGER", "MENTOR", "TEACHER", "TRAINER").contains(role.getName()));
        if (!author || !access.permitted(user, "MILESTONE_WRITE") && !access.permitted(user, "PRJ_WORKSPACE_MANAGE"))
            throw new org.springframework.security.access.AccessDeniedException("Project assessment management permission is required");
    }

    @Override
    public boolean isCompleted(Long projectId, Long tenantId) {
        return projectId != null && tenantId != null && projects.findById(projectId)
                .filter(project -> tenantId.equals(project.getTenantId()))
                .map(project -> project.getStatus() == ProjectStatus.COMPLETED).orElse(false);
    }

    @Override
    public boolean isActive(Long projectId, Long tenantId) {
        return projectId != null && tenantId != null && projects.findById(projectId)
                .filter(project -> tenantId.equals(project.getTenantId()) && Boolean.TRUE.equals(project.getIsActive()))
                .map(project -> project.getStatus() == ProjectStatus.ACTIVE).orElse(false);
    }

    @Override
    public List<CompletionTarget> lockHierarchy(Long projectId, Long tenantId, Long teamId) {
        if (projectId == null || tenantId == null) return List.of();
        var path = new ArrayList<ProjectRepository.CompletionScope>();
        var visited = new HashSet<Long>();
        Long currentId = projectId;
        while (currentId != null) {
            if (!visited.add(currentId)) return List.of();
            var scope = projects.findCompletionScope(currentId, tenantId);
            if (scope.isEmpty()) break;
            path.add(scope.get());
            currentId = scope.get().getParentProjectId();
        }
        if (path.isEmpty() || !Objects.equals(teamId, path.getFirst().getTeamId())) return List.of();

        for (int index = path.size() - 1; index >= 0; index--) {
            var scope = path.get(index);
            var locked = projects.lockForCompletion(scope.getId(), tenantId);
            if (locked.isEmpty()) return List.of();
            Project project = locked.get();
            entityManager.refresh(project, LockModeType.PESSIMISTIC_WRITE);
            Long parentId = project.getParentProject() == null ? null : project.getParentProject().getId();
            if (!Boolean.TRUE.equals(project.getIsActive()) || !tenantId.equals(project.getTenantId())
                    || !Objects.equals(scope.getTeamId(), project.getTeamId())
                    || !Objects.equals(scope.getParentProjectId(), parentId)) return List.of();
        }
        return path.stream().map(scope -> new CompletionTarget(scope.getId(), scope.getTeamId())).toList();
    }

    @Override
    public ChildCompletion childCompletion(Long projectId, Long tenantId) {
        boolean hasActiveChild = false;
        for (Project child : projects.lockChildrenForCompletion(projectId)) {
            entityManager.refresh(child, LockModeType.PESSIMISTIC_WRITE);
            if (!Boolean.TRUE.equals(child.getIsActive())) continue;
            hasActiveChild = true;
            if (!tenantId.equals(child.getTenantId()) || child.getStatus() != ProjectStatus.COMPLETED)
                return ChildCompletion.PENDING;
        }
        return hasActiveChild ? ChildCompletion.COMPLETED : ChildCompletion.NONE;
    }

    @Override
    public boolean complete(Long projectId, Long tenantId, Long teamId, UUID actorId, Instant completedAt) {
        var candidate = projects.findById(projectId)
                .filter(project -> tenantId.equals(project.getTenantId())
                        && Boolean.TRUE.equals(project.getIsActive())
                        && Objects.equals(teamId, project.getTeamId()) && project.getStatus() == ProjectStatus.ACTIVE);
        if (candidate.isEmpty()) return false;
        candidate.get().setStatus(ProjectStatus.COMPLETED);
        projects.saveAndFlush(candidate.get());
        return true;
    }
}
