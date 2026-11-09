package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneProjectOptionResponse;
import com.example.starter_project_2025.system.project.milestone.integration.model.*;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Uses the same project/team context as Workspace instead of fixed mock state. */
@Component @Primary @Profile("!test | artifact-real-scope") @RequiredArgsConstructor
public class JpaProjectMilestoneAdapter implements ProjectMilestonePort {
    private final WorkspaceAccessService access;
    private final ProjectTeamRepository teams;
    private final WorkspaceRepository workspaces;

    private User actor(UUID actorId, Long tenantId) {
        var user=access.requireUser(false);
        access.requireTenant(user,false);
        if(!Objects.equals(user.getTenantId(),tenantId)
                ||!UUID.nameUUIDFromBytes(user.getEmail().getBytes(StandardCharsets.UTF_8)).equals(actorId))throw denied();
        return user;
    }

    private boolean inScope(Project project, User user) {
        Long id=project.getId();
        boolean administrator=user.getRoles().stream().anyMatch(role->Boolean.TRUE.equals(role.getIsActive())
                &&Set.of("ADMIN","SUPER_ADMIN","SYSTEM_ADMIN","PO").contains(role.getName()));
        if(administrator)return true;
        return teams.findAllByProject_IdInOrderByIdDesc(List.of(id)).stream().anyMatch(team->{
            try {access.requireTeam(user,team.getId(),false);return true;}
            catch(AccessDeniedException|org.springframework.web.server.ResponseStatusException unavailable){return false;}
        });
    }

    private Project scoped(Long id,UUID actorId,Long tenantId) {
        var user=actor(actorId,tenantId);
        Project project=access.requireProject(user,id,false);
        if(!inScope(project,user))throw denied();
        return project;
    }

    @Override public List<MilestoneProjectOptionResponse> listAccessibleProjects(UUID actorId,Long tenantId) {
        User user=actor(actorId,tenantId);
        Map<Long, MilestoneProjectOptionResponse> options = new LinkedHashMap<>();
        for (Workspace workspace : workspaces.findAllByTenant_IdAndStatusAndIsActiveTrue(
                tenantId, WorkspaceStatus.ACTIVE)) {
            ProjectTeam team = workspace.getTeam();
            Project project = workspace.getProject() != null ? workspace.getProject()
                    : team == null ? null : team.getProject();
            if (!eligibleWorkspace(workspace, team, project, user, tenantId)) continue;
            boolean canCreate = access.permitted(user, "MILESTONE_WRITE") && access.projectCanStart(project);
            options.putIfAbsent(project.getId(), new MilestoneProjectOptionResponse(project.getId(),
                    project.getCode(), project.getName(), ProjectStatus.valueOf(project.getStatus().name()),
                    team.getId(), canCreate));
        }
        return options.values().stream()
                .sorted(Comparator.comparingInt((MilestoneProjectOptionResponse option)->switch(option.status()) {
                    case ACTIVE -> 0;
                    case PLANNING -> 1;
                    case DRAFT -> 2;
                    case COMPLETED -> 3;
                    case CANCELLED -> 4;
                }).thenComparing(MilestoneProjectOptionResponse::name,String.CASE_INSENSITIVE_ORDER)
                  .thenComparing(MilestoneProjectOptionResponse::id))
                .toList();
    }

    private boolean eligibleWorkspace(Workspace workspace, ProjectTeam team, Project project, User user, Long tenantId) {
        if (project == null || !Boolean.TRUE.equals(project.getIsActive()) || project.getStatus() == null
                || !Objects.equals(project.getTenantId(), tenantId)
                || team == null || team.getProject() == null
                || !Objects.equals(team.getProject().getId(), project.getId())
                || !Boolean.TRUE.equals(team.getIsActive()) || team.getStatus() != ProjectTeamStatus.ACTIVE
                || team.getTrainingClass() == null || !Boolean.TRUE.equals(team.getTrainingClass().getIsActive())
                || !Objects.equals(team.getTrainingClass().getTenantId(), tenantId)) return false;
        if (workspace.getTenant() == null || !Objects.equals(workspace.getTenant().getId(), tenantId)) return false;
        try { access.requireTeam(user, team.getId(), false); return true; }
        catch (AccessDeniedException | org.springframework.web.server.ResponseStatusException unavailable) { return false; }
    }
    @Override public ProjectReadContext requireProjectForRead(Long projectId,UUID actorId,Long tenantId) {
        var project=scoped(projectId,actorId,tenantId);
        return new ProjectReadContext(projectId,tenantId,project.getName(),ProjectStatus.valueOf(project.getStatus().name()),true,true);
    }
    @Override public ProjectCreationContext requireProjectForCreation(Long projectId,UUID actorId,Long tenantId) {
        var project=scoped(projectId,actorId,tenantId);
        return new ProjectCreationContext(projectId,tenantId,project.getName(),ProjectStatus.valueOf(project.getStatus().name()),true,true,access.projectCanStart(project));
    }
    private AccessDeniedException denied() {return new AccessDeniedException("Project is outside the current workspace scope");}
}
