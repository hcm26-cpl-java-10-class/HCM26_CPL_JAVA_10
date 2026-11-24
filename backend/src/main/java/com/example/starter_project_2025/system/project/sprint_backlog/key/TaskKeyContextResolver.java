package com.example.starter_project_2025.system.project.sprint_backlog.key;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignment;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignmentRepository;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Finds the tenant and the key prefix of a backlog item from what it belongs to.
 * <ol>
 *     <li>Item of a project: the workspace the project is assigned to
 *     ({@code team_subproject_assignments}), else a workspace of the project itself,
 *     else the same lookup on the parent project (a module inherits its master's
 *     workspace). Tenant = the project's tenant.</li>
 *     <li>Team-only item (no project): the current workspace of the sprint's team.</li>
 *     <li>No workspace found: the default prefix {@value TaskKeyFormat#DEFAULT_PREFIX}.</li>
 * </ol>
 */
@Component
@RequiredArgsConstructor
public class TaskKeyContextResolver {

    private static final int MAX_DEPTH = 10;

    public record Context(Long tenantId, String prefix) {
    }

    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;
    private final WorkspaceRepository workspaces;
    private final TeamSubprojectAssignmentRepository assignments;

    /** Empty when no tenant can be found (the item then stays without a key and is logged). */
    @Transactional(readOnly = true)
    public Optional<Context> resolve(Long projectId, Long sprintTeamId) {
        Project project = projectId == null ? null : projects.findById(projectId).orElse(null);
        if (project != null) {
            Long tenantId = project.getTenantId() != null ? project.getTenantId()
                    : project.getTenant() == null ? null : project.getTenant().getId();
            if (tenantId != null) {
                String prefix = prefixOfProject(project);
                if (prefix == null && sprintTeamId != null) prefix = prefixOfTeam(sprintTeamId);
                return Optional.of(new Context(tenantId, TaskKeyFormat.prefixOrDefault(prefix)));
            }
        }
        if (sprintTeamId == null) return Optional.empty();
        Workspace workspace = workspaces.findCurrentByTeamId(sprintTeamId).orElse(null);
        Long tenantId = workspace != null && workspace.getTenant() != null ? workspace.getTenant().getId()
                : teams.findById(sprintTeamId)
                    .map(team -> team.getTrainingClass() == null ? null : team.getTrainingClass().getTenantId())
                    .orElse(null);
        if (tenantId == null) return Optional.empty();
        return Optional.of(new Context(tenantId,
                TaskKeyFormat.prefixOrDefault(workspace == null ? null : workspace.getTaskKeyPrefix())));
    }

    private String prefixOfProject(Project start) {
        Project current = start;
        for (int depth = 0; current != null && depth <= MAX_DEPTH; depth++) {
            for (TeamSubprojectAssignment assignment : assignments.findAllByProject_IdAndIsActiveTrueOrderByIdAsc(current.getId())) {
                if (assignment.getWorkspaceId() == null) continue;
                String prefix = workspaces.findById(assignment.getWorkspaceId()).map(Workspace::getTaskKeyPrefix).orElse(null);
                if (TaskKeyFormat.isValidPrefix(prefix)) return prefix;
            }
            String own = workspaces.findFirstByProjectIdOrderByIdAsc(current.getId()).map(Workspace::getTaskKeyPrefix).orElse(null);
            if (TaskKeyFormat.isValidPrefix(own)) return own;
            current = current.getParentProject();
        }
        return null;
    }

    private String prefixOfTeam(Long teamId) {
        String prefix = workspaces.findCurrentByTeamId(teamId).map(Workspace::getTaskKeyPrefix).orElse(null);
        return TaskKeyFormat.isValidPrefix(prefix) ? prefix : null;
    }
}
