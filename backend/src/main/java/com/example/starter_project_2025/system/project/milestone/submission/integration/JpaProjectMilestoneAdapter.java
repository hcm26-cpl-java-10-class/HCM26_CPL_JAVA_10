package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.milestone.integration.model.*;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
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

    private Project scoped(Long id,UUID actorId,Long tenantId) {
        var user=access.requireUser(false);access.requireTenant(user,false);
        if(!Objects.equals(user.getTenantId(),tenantId)
                ||!UUID.nameUUIDFromBytes(user.getEmail().getBytes(StandardCharsets.UTF_8)).equals(actorId))throw denied();
        Project project=access.requireProject(user,id,false);
        boolean administrator=user.getRoles().stream().anyMatch(role->Boolean.TRUE.equals(role.getIsActive())
                &&Set.of("ADMIN","SUPER_ADMIN","SYSTEM_ADMIN","PO").contains(role.getName()));
        if(!administrator) {
            boolean assigned=teams.findAllByProject_IdInOrderByIdDesc(List.of(id)).stream().anyMatch(team->{
                try {access.requireTeam(user,team.getId(),false);return true;}
                catch(AccessDeniedException|org.springframework.web.server.ResponseStatusException unavailable){return false;}
            });
            if(!assigned)throw denied();
        }
        return project;
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
