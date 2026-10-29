package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.template.assignment.TemplateAssignmentProvisioningService;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceSection;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCreateRequest;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceResponse;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.ArrayList;
import java.util.Arrays;

@Service
@RequiredArgsConstructor
public class WorkspaceCreationTransaction {
    private final WorkspaceAccessService access;
    private final WorkspaceRepository workspaces;
    private final WorkspaceIdempotencyService idempotency;
    private final WorkspaceJournalService journal;
    private final WorkspaceProjectSelection selection;
    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;
    private final TemplateAssignmentProvisioningService provisioning;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public WorkspaceResponse create(String key, WorkspaceCreateRequest request, String correlationId) {
        var user = access.requireUser(true);
        var tenant = access.requireTenant(user, true);
        selection.validate(request);
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "X-Idempotency-Key bắt buộc và không quá 128 ký tự");
        }
        var previous = idempotency.find(tenant.getId(), user.getId(), key);
        if (previous != null) idempotency.checkPayload(previous, request);
        ProjectTeam team = access.requireTeam(user, request.getTeamId(), true);
        // Re-read after acquiring the team lock: another request may have committed while this one waited.
        previous = idempotency.find(tenant.getId(), user.getId(), key);
        if (previous != null) {
            idempotency.checkPayload(previous, request);
            return idempotency.response(previous);
        }
        var chosen = selection.resolve(user, request, true);
        if (chosen.project() == null && team.getProjectTemplate() != null) {
            provisioning.provision(team, team.getProjectTemplate(), user.getId(), correlationId);
            Workspace workspace = workspaces.findFirstByTeamIdOrderByIdAsc(team.getId())
                    .orElseThrow(() -> new IllegalStateException("The project workspace was not created"));
            WorkspaceResponse response = response(workspace);
            idempotency.save(tenant.getId(), user.getId(), key, request, response);
            return response;
        }
        Workspace workspace = new Workspace();
        workspace.setTenant(tenant); workspace.setProject(chosen.project()); workspace.setTeam(team);
        workspace.setCode("WS-TEAM-" + request.getTeamId());
        workspace.setName("Workspace / " + team.getTeamName());
        workspace.setStatus(WorkspaceStatus.ACTIVE);
        workspace.setCreatedBy(user.getId());
        workspace.setSections(new ArrayList<>(Arrays.asList(WorkspaceSection.values())));
        workspaces.saveAndFlush(workspace);
        WorkspaceResponse response = response(workspace);
        journal.recordCreation(workspace, user, response, correlationId);
        idempotency.save(tenant.getId(), user.getId(), key, request, response);
        return response;
    }

    private WorkspaceResponse response(Workspace workspace) {
        return WorkspaceResponse.builder()
                .id(workspace.getId()).tenantId(workspace.getTenant().getId())
                .projectId(workspace.getProject() == null ? null : workspace.getProject().getId())
                .teamId(workspace.getTeam().getId()).code(workspace.getCode()).name(workspace.getName())
                .status(workspace.getStatus()).createdBy(workspace.getCreatedBy()).createdAt(workspace.getCreatedAt())
                .sections(workspace.getSections().stream().map(WorkspaceSection::getKey).toList()).build();
    }

    private Project createProjectForTeam(ProjectTeam team, Long tenantId) {
        if (team.getProject() != null) {
            return team.getProject();
        }
        ProjectTemplate template = team.getProjectTemplate();
        if (template == null) {
            return null;
        }

        Project project = new Project();
        project.setCode("TEAM-" + team.getId());
        project.setName(template.getName());
        project.setDescription(template.getDescription());
        project.setTenantId(tenantId);
        project.setStatus(ProjectStatus.PLANNING);
        project = projects.saveAndFlush(project);
        team.setProject(project);
        teams.saveAndFlush(team);
        return project;
    }
}
