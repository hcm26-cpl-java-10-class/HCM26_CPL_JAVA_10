package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Resolves a live, tenant-scoped choice without writing until creation is confirmed. */
@Service
@RequiredArgsConstructor
public class WorkspaceProjectSelection {
    private final WorkspaceAccessService access;
    private final WorkspaceRepository workspaces;
    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;

    public record Option(Long projectId, String name, String code, String status, String cohortName) { }
    public record Selection(ProjectTeam team, Project project) { }

    public List<Option> options(User user, Long teamId) {
        access.requireTenant(user, false);
        ProjectTeam team = access.requireTeam(user, teamId, false);
        if (workspaces.findFirstByTeamIdOrderByIdAsc(teamId).isPresent()) return List.of();
        var result = new ArrayList<Option>();
        projects.findByTenantIdAndIsActiveTrue(user.getTenant().getId()).stream()
                .filter(project -> team.getProjectId() == null || team.getProjectId().equals(project.getId()))
                .filter(project -> !teams.existsByProject_IdAndIdNot(project.getId(), teamId))
                .filter(project -> access.canSelectProject(user, project))
                .filter(access::projectCanStart).filter(project -> !workspaces.existsByProjectId(project.getId()))
                .forEach(project -> result.add(new Option(project.getId(), project.getName(), project.getCode(),
                        project.getStatus().name(), project.getCohort() == null ? null : project.getCohort().getName())));
        result.sort(Comparator.comparing(Option::name));
        return result;
    }

    public void validate(WorkspaceCreateRequest request) {
        if (request.getTeamId() == null || request.getTeamId() <= 0) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Select an existing team");
        }
    }

    public Selection resolve(User user, WorkspaceCreateRequest request, boolean lock) {
        validate(request);
        // Always lock team before project. Competing selections for one team serialize here.
        ProjectTeam team = access.requireTeam(user, request.getTeamId(), lock);
        Workspace existing = workspaces.findFirstByTeamIdOrderByIdAsc(team.getId()).orElse(null);
        if (existing != null) throw new WorkspaceConflictException("This team already has a workspace", access.canRead(user) ? existing.getId() : null);
        if (!access.hasMembers(team)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Add at least one active member to this team before creating a workspace.");
        Project project = team.getProject();
        if (project == null) {
            project = projects.save(Project.builder()
                    .tenant(user.getTenant())
                    .code("TEAM-" + team.getId())
                    .name(team.getTeamName())
                    .status(ProjectStatus.ACTIVE)
                    .build());
            team.setProject(project);
            teams.saveAndFlush(team);
        }
        if (team.getProjectId() != null && !team.getProjectId().equals(project.getId())) {
            throw new WorkspaceRelationshipException("This team is already assigned to a different project.");
        }
        if (teams.existsByProject_IdAndIdNot(project.getId(), team.getId())) {
            throw new WorkspaceRelationshipException("This project is already assigned to another team.");
        }
        if (team.getProjectId() != null && !access.canSelectProject(user, project)) {
            throw new org.springframework.security.access.AccessDeniedException("Project is outside the current scope");
        }
        if (workspaces.existsByProjectId(project.getId())) throw new WorkspaceConflictException("This project already has a workspace. Select another project.", null);
        return new Selection(team, project);
    }
}
