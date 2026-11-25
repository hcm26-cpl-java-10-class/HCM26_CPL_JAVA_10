package com.example.starter_project_2025.system.project.developmentinsights;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitContributorRepository;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityScope;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityScopeService;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignmentRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceContextService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceProjectScope;
import com.example.starter_project_2025.system.rbac.user.User;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GitActivityScopeServiceTest {
    @Mock WorkspaceAccessService access;
    @Mock WorkspaceContextService contexts;
    @Mock WorkspaceProjectScope workspaceProjects;
    @Mock ProjectRepository projects;
    @Mock ProjectTeamRepository teams;
    @Mock TeamSubprojectAssignmentRepository assignments;
    @Mock ProjectMemberRepository members;
    @Mock GitContributorRepository contributors;

    GitActivityScopeService service;
    User actor;
    Workspace workspace;
    Project root;
    Project child;
    Project grandchild;

    @BeforeEach
    void setUp() {
        service = new GitActivityScopeService(access, contexts, workspaceProjects, projects,
                teams, assignments, members, contributors);
        actor = org.mockito.Mockito.mock(User.class);
        Tenant tenant = org.mockito.Mockito.mock(Tenant.class);
        when(tenant.getId()).thenReturn(77L);
        workspace = org.mockito.Mockito.mock(Workspace.class);
        when(workspace.getTenant()).thenReturn(tenant);
        when(access.requireUser(false)).thenReturn(actor);
        when(access.permitted(actor, "SPRINT_BACKLOG_READ")).thenReturn(true);
        when(contexts.require(actor, 9L)).thenReturn(workspace);

        root = project(1L, null);
        child = project(2L, root);
        grandchild = project(3L, child);
        when(projects.findAllByParentProject_IdAndIsActiveTrueOrderByIdAsc(root.getId())).thenReturn(List.of(child));
        when(projects.findAllByParentProject_IdAndIsActiveTrueOrderByIdAsc(child.getId())).thenReturn(List.of(grandchild));
        when(projects.findAllByParentProject_IdAndIsActiveTrueOrderByIdAsc(grandchild.getId())).thenReturn(List.of());
        when(teams.findAllByProject_IdInOrderByIdDesc(List.of(root.getId()))).thenReturn(List.of());
    }

    @Test
    void moduleScopeResolvesTopAncestorWithoutWideningToUnassignedDescendants() {
        when(workspaceProjects.projects(workspace)).thenReturn(List.of(child));

        GitActivityScope scope = service.require(9L);

        assertThat(scope.rootProjectId()).isEqualTo(root.getId());
        assertThat(scope.rootScope()).isFalse();
        assertThat(scope.projectIds()).containsExactly(child.getId());
    }

    @Test
    void rootScopeIncludesEveryActiveDescendantRecursively() {
        when(workspaceProjects.projects(workspace)).thenReturn(List.of(root));

        GitActivityScope scope = service.require(9L);

        assertThat(scope.rootProjectId()).isEqualTo(root.getId());
        assertThat(scope.rootScope()).isTrue();
        assertThat(scope.projectIds()).containsExactlyInAnyOrder(root.getId(), child.getId(), grandchild.getId());
    }

    @Test
    void rootProjectFilterIncludesMembersAssignedOnlyToModules() {
        User rootMember = user(10L, "Root Member");
        User moduleMember = user(11L, "Module Member");
        stubProjectMembers(root.getId(), 101L, List.of(rootMember));
        stubProjectMembers(child.getId(), 102L, List.of(moduleMember));
        when(workspaceProjects.projects(workspace)).thenReturn(List.of(root));

        GitActivityScope scope = service.require(9L);

        assertThat(scope.membersFor(root.getId())).extracting(GitActivityScope.MemberIdentity::name)
                .containsExactlyInAnyOrder("Root Member", "Module Member");
    }

    @Test
    void moduleFilterKeepsMemberAssignedToSeveralModulesInScope() {
        User sharedMember = user(12L, "Shared Module Member");
        stubProjectMembers(child.getId(), 201L, List.of(sharedMember));
        stubProjectMembers(grandchild.getId(), 202L, List.of(sharedMember));
        when(workspaceProjects.projects(workspace)).thenReturn(List.of(child, grandchild));

        GitActivityScope scope = service.require(9L);

        assertThat(scope.membersFor(child.getId())).extracting(GitActivityScope.MemberIdentity::name)
                .containsExactly("Shared Module Member");
        assertThat(scope.membersFor(grandchild.getId())).extracting(GitActivityScope.MemberIdentity::name)
                .containsExactly("Shared Module Member");
    }

    private User user(Long id, String name) {
        User user = new User();
        user.setId(id);
        user.setFirstName(name);
        user.setUsername(name.toLowerCase().replace(' ', '.'));
        user.setTenantId(77L);
        user.setTenant(workspace.getTenant());
        return user;
    }

    private void stubProjectMembers(Long projectId, Long teamId, List<User> users) {
        ProjectTeam team = new ProjectTeam();
        team.setId(teamId);
        when(teams.findAllByProject_IdInOrderByIdDesc(List.of(projectId))).thenReturn(List.of(team));
        List<ProjectMember> projectMembers = users.stream().map(user -> {
            ClassMember classMember = new ClassMember();
            classMember.setIsActive(true);
            classMember.setStatus(ClassMemberStatus.ACTIVE);
            classMember.setUser(user);
            ProjectMember projectMember = new ProjectMember();
            projectMember.setIsActive(true);
            projectMember.setClassMember(classMember);
            return projectMember;
        }).toList();
        when(members.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(teamId, ClassMemberStatus.ACTIVE))
                .thenReturn(projectMembers);
    }

    private Project project(Long id, Project parent) {
        Project project = new Project();
        project.setId(id);
        project.setTenantId(77L);
        project.setIsActive(true);
        project.setStatus(ProjectStatus.ACTIVE);
        project.setParentProject(parent);
        return project;
    }
}
