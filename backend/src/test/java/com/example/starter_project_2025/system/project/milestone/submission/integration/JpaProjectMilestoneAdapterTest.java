package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JpaProjectMilestoneAdapterTest {
    @Mock WorkspaceAccessService access;
    @Mock ProjectRepository projects;
    @Mock ProjectTeamRepository teams;
    @InjectMocks JpaProjectMilestoneAdapter adapter;

    private static final Long TENANT_ID = 7L;
    private static final String EMAIL = "admin@example.com";

    @Test
    void listsActiveTenantProjectsForAdministratorWithActiveProjectsFirst() {
        currentUser("ADMIN");
        Project draft = project(2L, "DRAFT", ProjectStatus.DRAFT);
        Project active = project(1L, "ACTIVE", ProjectStatus.ACTIVE);
        when(projects.findByTenantIdAndIsActiveTrue(TENANT_ID)).thenReturn(List.of(draft, active));

        var options = adapter.listAccessibleProjects(actorId(), TENANT_ID);

        assertEquals(List.of(1L, 2L), options.stream().map(option -> option.id()).toList());
        assertEquals("ACTIVE", options.get(0).code());
        assertEquals(com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus.ACTIVE,
                options.get(0).status());
        verify(teams, never()).findAllByProject_IdInOrderByIdDesc(List.of(1L));
    }

    @Test
    void listsOnlyProjectsWithAnAccessibleTeamForNonAdministrator() {
        User user = currentUser("STUDENT");
        Project assigned = project(1L, "ASSIGNED", ProjectStatus.ACTIVE);
        Project other = project(2L, "OTHER", ProjectStatus.ACTIVE);
        ProjectTeam team = org.mockito.Mockito.mock(ProjectTeam.class);
        when(team.getId()).thenReturn(10L);
        when(projects.findByTenantIdAndIsActiveTrue(TENANT_ID)).thenReturn(List.of(assigned, other));
        when(teams.findAllByProject_IdInOrderByIdDesc(List.of(1L))).thenReturn(List.of(team));
        when(teams.findAllByProject_IdInOrderByIdDesc(List.of(2L))).thenReturn(List.of());
        when(access.requireTeam(eq(user), eq(10L), eq(false))).thenReturn(team);

        var options = adapter.listAccessibleProjects(actorId(), TENANT_ID);

        assertEquals(List.of(1L), options.stream().map(option -> option.id()).toList());
    }

    private User currentUser(String roleName) {
        User user = org.mockito.Mockito.mock(User.class);
        Role role = org.mockito.Mockito.mock(Role.class);
        when(user.getTenantId()).thenReturn(TENANT_ID);
        when(user.getEmail()).thenReturn(EMAIL);
        when(user.getRoles()).thenReturn(Set.of(role));
        when(role.getIsActive()).thenReturn(true);
        when(role.getName()).thenReturn(roleName);
        when(access.requireUser(false)).thenReturn(user);
        return user;
    }

    private Project project(Long id, String code, ProjectStatus status) {
        Project project = new Project();
        project.setId(id);
        project.setCode(code);
        project.setName(code);
        project.setStatus(status);
        return project;
    }

    private UUID actorId() {
        return UUID.nameUUIDFromBytes(EMAIL.getBytes(StandardCharsets.UTF_8));
    }
}
