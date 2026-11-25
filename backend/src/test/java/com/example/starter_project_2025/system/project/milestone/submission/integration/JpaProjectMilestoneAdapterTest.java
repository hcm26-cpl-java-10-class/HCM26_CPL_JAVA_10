package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JpaProjectMilestoneAdapterTest {
    private static final Long TENANT_ID = 7L;
    private static final String EMAIL = "admin@example.com";

    @Mock WorkspaceAccessService access;
    @Mock ProjectTeamRepository teams;
    @Mock WorkspaceRepository workspaces;
    @InjectMocks JpaProjectMilestoneAdapter adapter;

    @Test
    void listsWorkspaceProjectsIncludingThoseWithoutTemplateSnapshot() {
        User user = currentUser();
        Project active = project(1L, "ACTIVE", ProjectStatus.ACTIVE);
        Project legacy = project(2L, "LEGACY", ProjectStatus.COMPLETED);
        legacy.setTemplateSnapshotId(null);
        Workspace activeWorkspace = workspace(active, user, 10L, false, true);
        Workspace legacyWorkspace = workspace(legacy, user, 20L, true, true);
        when(workspaces.findAllByTenant_IdAndStatusAndIsActiveTrue(TENANT_ID, WorkspaceStatus.ACTIVE))
                .thenReturn(List.of(legacyWorkspace, activeWorkspace));
        when(access.permitted(user, "MILESTONE_WRITE")).thenReturn(true);
        when(access.projectCanStart(any(Project.class))).thenAnswer(invocation ->
                ((Project) invocation.getArgument(0)).getStatus() == ProjectStatus.ACTIVE);

        var options = adapter.listAccessibleProjects(actorId(), TENANT_ID);

        assertEquals(List.of(1L, 2L), options.stream().map(option -> option.id()).toList());
        assertEquals(10L, options.get(0).teamId());
        assertEquals(true, options.get(0).canCreate());
        assertEquals(false, options.get(1).canCreate());
    }

    @Test
    void excludesProjectWithoutWorkspace() {
        currentUser();
        when(workspaces.findAllByTenant_IdAndStatusAndIsActiveTrue(TENANT_ID, WorkspaceStatus.ACTIVE))
                .thenReturn(List.of());

        assertEquals(List.of(), adapter.listAccessibleProjects(actorId(), TENANT_ID));
    }

    @Test
    void excludesWorkspaceOutsideUsersTeamScope() {
        User user = currentUser();
        Project project = project(1L, "OTHER", ProjectStatus.ACTIVE);
        Workspace workspace = workspace(project, user, 10L, false, false);
        when(workspaces.findAllByTenant_IdAndStatusAndIsActiveTrue(TENANT_ID, WorkspaceStatus.ACTIVE))
                .thenReturn(List.of(workspace));

        assertEquals(List.of(), adapter.listAccessibleProjects(actorId(), TENANT_ID));
    }

    private Workspace workspace(Project project, User user, Long teamId,
                                boolean projectStoredOnTeamOnly, boolean accessible) {
        ProjectTeam team = mock(ProjectTeam.class);
        TrainingClass trainingClass = mock(TrainingClass.class);
        Workspace workspace = mock(Workspace.class);
        Tenant tenant = mock(Tenant.class);
        when(workspace.getTeam()).thenReturn(team);
        if (!projectStoredOnTeamOnly) when(workspace.getProject()).thenReturn(project);
        when(workspace.getTenant()).thenReturn(tenant);
        when(tenant.getId()).thenReturn(TENANT_ID);
        when(team.getProject()).thenReturn(project);
        when(team.getId()).thenReturn(teamId);
        when(team.getIsActive()).thenReturn(true);
        when(team.getStatus()).thenReturn(ProjectTeamStatus.ACTIVE);
        when(team.getTrainingClass()).thenReturn(trainingClass);
        when(trainingClass.getIsActive()).thenReturn(true);
        when(trainingClass.getTenantId()).thenReturn(TENANT_ID);
        if (accessible) when(access.requireTeam(user, teamId, false)).thenReturn(team);
        else when(access.requireTeam(user, teamId, false)).thenThrow(new AccessDeniedException("Not assigned"));
        return workspace;
    }

    private User currentUser() {
        User user = mock(User.class);
        when(user.getTenantId()).thenReturn(TENANT_ID);
        when(user.getEmail()).thenReturn(EMAIL);
        when(access.requireUser(false)).thenReturn(user);
        return user;
    }

    private Project project(Long id, String code, ProjectStatus status) {
        Project project = new Project();
        project.setId(id);
        project.setCode(code);
        project.setName(code);
        project.setTenantId(TENANT_ID);
        project.setStatus(status);
        project.setIsActive(true);
        project.setTemplateSnapshotId(id);
        return project;
    }

    private UUID actorId() {
        return UUID.nameUUIDFromBytes(EMAIL.getBytes(StandardCharsets.UTF_8));
    }
}
