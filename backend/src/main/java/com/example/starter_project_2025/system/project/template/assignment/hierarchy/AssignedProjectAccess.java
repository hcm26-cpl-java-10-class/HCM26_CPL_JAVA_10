package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class AssignedProjectAccess {
    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;
    private final WorkspaceRepository workspaces;
    private final WorkspaceAccessService access;

    public void requireProject(Long projectId, boolean writing) {
        if (projectId == null) return;
        var project = projects.findById(projectId).orElse(null);
        if (project == null) return;
        if (project.getAssignmentId() != null) {
            var user = access.requireUser(false);
            access.requireTenant(user, false);
            if (!project.getTenantId().equals(user.getTenantId()) || !access.canAccessProject(user, project))
                throw new AccessDeniedException("Project is outside the assigned workspace scope");
        }
        if (writing && Set.of(ProjectStatus.COMPLETED, ProjectStatus.CANCELLED).contains(project.getStatus()))
            throw new AccessDeniedException("This project is closed and its workspace is read-only");
    }

    public Long currentProject(Long teamId) {
        if (teamId == null) return null;
        var team = teams.findById(teamId).orElse(null);
        return team != null && team.getProject() != null && team.getProject().getAssignmentId() != null
                ? team.getProjectId() : null;
    }

    public void requireTeam(Long projectId, Long teamId) {
        if (projectId == null || teamId == null) return;
        var project = projects.findById(projectId).orElse(null);
        if (project != null && project.getAssignmentId() != null && !teamId.equals(project.getTeamId()))
            throw new AccessDeniedException("The selected team does not own this project");
    }

    public void requireTeamOnlyWrite(Long teamId) {
        if (teamId == null) return;
        var current = workspaces.findCurrentByTeamId(teamId).orElse(null);
        if (current != null && current.getProject() != null && current.getProject().getAssignmentId() != null)
            throw new AccessDeniedException("Previous team-only work belongs to a read-only workspace");
    }

    public <T> org.springframework.data.jpa.domain.Specification<T> visibility() {
        Set<Long> allowed = new java.util.HashSet<>();
        try {
            var user = access.requireUser(false);
            projects.findByTenantIdAndIsActiveTrue(user.getTenantId()).stream()
                    .filter(project -> project.getAssignmentId() != null && access.canAccessProject(user, project))
                    .forEach(project -> allowed.add(project.getId()));
        } catch (AccessDeniedException denied) { }
        return (root, query, cb) -> {
            var hidden = query.subquery(Long.class);
            var project = hidden.from(com.example.starter_project_2025.system.project.domain.Project.class);
            hidden.select(project.get("id")).where(cb.isNotNull(project.get("assignmentId")),
                    allowed.isEmpty() ? cb.conjunction() : cb.not(project.get("id").in(allowed)));
            return cb.or(cb.isNull(root.get("projectId")), cb.not(root.get("projectId").in(hidden)));
        };
    }
}
