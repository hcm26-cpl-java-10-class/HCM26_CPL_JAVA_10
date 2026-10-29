package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.team.TeamRepository;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCreateRequest;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;

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
    private final ProjectTeamRepository teams;

    public record Option(Long projectId, String name, String code, String status, String cohortName) { }
    public record Selection(ProjectTeam team, Project project) { }

    public List<Option> options(User user, Long teamId) {
        access.requireTenant(user, false);
        ProjectTeam team = access.requireTeam(user, teamId, false);
        if (workspaces.findFirstByTeamIdOrderByIdAsc(teamId).isPresent()) return List.of();
        return List.of();
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
        if (project != null) access.requirePair(user, project.getId(), team.getId(), lock);
        if (project != null && !access.projectCanStart(project)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "The assigned project must be Planning or Active");
        }
        return new Selection(team, project);
    }
}
