package com.example.starter_project_2025.system.project.developmentinsights.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRule;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitDevelopmentRuleRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceRosterService;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

class GitDevelopmentRuleServiceTest {
    private GitActivityScopeService scopes;
    private WorkspaceAccessService access;
    private WorkspaceRosterService roster;
    private GitDevelopmentRuleRepository rules;
    private ProjectRepository projects;
    private GitDevelopmentRuleService service;
    private GitActivityScope scope;
    private Workspace workspace;
    private User actor;
    private Project root;

    @BeforeEach
    void setUp() {
        scopes = mock(GitActivityScopeService.class);
        access = mock(WorkspaceAccessService.class);
        roster = mock(WorkspaceRosterService.class);
        rules = mock(GitDevelopmentRuleRepository.class);
        projects = mock(ProjectRepository.class);
        service = new GitDevelopmentRuleService(scopes, access, roster, rules, projects);
        workspace = mock(Workspace.class);
        when(workspace.getTaskKeyPrefix()).thenReturn("FA");
        ProjectTeam team = mock(ProjectTeam.class);
        when(team.getAssignedMentorId()).thenReturn(null);
        when(workspace.getTeam()).thenReturn(team);
        when(roster.current(team)).thenReturn(List.of());
        root = mock(Project.class);
        when(root.getId()).thenReturn(10L);
        actor = mock(User.class);
        Role admin = mock(Role.class);
        when(admin.getIsActive()).thenReturn(true);
        when(admin.getName()).thenReturn("ADMIN");
        when(actor.getRoles()).thenReturn(Set.of(admin));
        scope = new GitActivityScope(workspace, 10L, Set.of(10L), true, Set.of(), java.util.Map.of(), true);
        when(scopes.require(4L)).thenReturn(scope);
        when(access.requireUser(false)).thenReturn(actor);
    }

    @Test
    void returnsBothRulesDisabledUntilConfiguredWithWorkspaceTaskPrefixDefault() {
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of());

        var result = service.list(4L);

        assertThat(result).hasSize(2);
        assertThat(result).allSatisfy(rule -> {
            assertThat(rule.enabled()).isFalse();
            assertThat(rule.version()).isZero();
            assertThat(rule.canManage()).isTrue();
        });
        assertThat(result.get(0).allowedCommitTypes()).containsExactly("feat", "fix", "docs", "refactor", "test", "chore");
        assertThat(result.get(1).taskKeyPattern()).contains("FA").contains("\\d+");
        assertThat(result.get(1).taskKeyExample()).isEqualTo("FA-123");
        assertThat(result.get(1).defaultTaskKeyPattern()).isEqualTo(result.get(1).taskKeyPattern());
    }

    @Test
    void readableTaskKeyExampleDoesNotReplaceTheSavedAdvancedPattern() {
        when(workspace.getTaskKeyPrefix()).thenReturn("SHOP");
        GitDevelopmentRule custom = GitDevelopmentRule.configure(root, GitDevelopmentRuleType.TASK_ID,
                2, true, "feat,fix", false, "(?i)\\bTICKET-\\d+\\b", actor, java.time.Instant.now());
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(custom));

        var rule = service.list(4L).get(1);

        assertThat(rule.taskKeyPattern()).isEqualTo("(?i)\\bTICKET-\\d+\\b");
        assertThat(rule.taskKeyExample()).isEqualTo("SHOP-123");
        assertThat(rule.defaultTaskKeyPattern()).contains("SHOP");
        assertThat(rule.enabled()).isTrue();
        assertThat(rule.version()).isEqualTo(2);
    }

    @Test
    void savesASeparateConfigurationVersionAndNormalizesEnabledTypes() {
        GitDevelopmentRule current = GitDevelopmentRule.configure(root, GitDevelopmentRuleType.CONVENTIONAL_COMMIT,
                1, false, "feat,fix", false, "(?i)\\bFA-\\d+\\b", actor, java.time.Instant.now());
        when(rules.findFirstByRootProject_IdAndTypeOrderByVersionDesc(10L, GitDevelopmentRuleType.CONVENTIONAL_COMMIT))
                .thenReturn(Optional.of(current));
        when(projects.findForWorkspaceCreation(10L)).thenReturn(Optional.of(root));
        when(rules.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var saved = service.save(4L, new GitDevelopmentRuleService.RuleInput(GitDevelopmentRuleType.CONVENTIONAL_COMMIT,
                true, List.of(" FEAT ", "fix", "feat"), true, "(?i)\\bFA-\\d+\\b"));

        assertThat(saved.enabled()).isTrue();
        assertThat(saved.version()).isEqualTo(2);
        assertThat(saved.allowedCommitTypes()).containsExactly("feat", "fix");
        assertThat(saved.scopeRequired()).isTrue();
        verify(rules).saveAndFlush(any(GitDevelopmentRule.class));
    }

    @Test
    void rejectsInvalidTaskPatternBeforeCreatingANewVersion() {
        assertThatThrownBy(() -> service.save(4L, new GitDevelopmentRuleService.RuleInput(
                GitDevelopmentRuleType.TASK_ID, true, List.of(), false, "[")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not a valid regular expression");

        org.mockito.Mockito.verifyNoInteractions(projects, rules);
    }

    @Test
    void rootOnlyRuleCannotBeChangedFromModuleWorkspaceEvenByAdministrator() {
        GitActivityScope module = new GitActivityScope(workspace, 10L, Set.of(11L), false,
                Set.of(), java.util.Map.of(), true);
        when(scopes.require(5L)).thenReturn(module);

        assertThatThrownBy(() -> service.save(5L, new GitDevelopmentRuleService.RuleInput(
                GitDevelopmentRuleType.TASK_ID, true, List.of(), false, "(?i)\\bFA-\\d+\\b")))
                .isInstanceOf(AccessDeniedException.class);
        org.mockito.Mockito.verifyNoInteractions(projects, rules);
    }

    @Test
    void unrelatedMilestonePermissionDoesNotGrantRuleConfigurationAccess() {
        org.mockito.Mockito.when(actor.getRoles()).thenReturn(Set.of());
        when(access.permitted(actor, "MILESTONE_WRITE")).thenReturn(true);
        when(access.permitted(actor, "WORKSPACE_UPDATE")).thenReturn(false);

        assertThatThrownBy(() -> service.save(4L, new GitDevelopmentRuleService.RuleInput(
                GitDevelopmentRuleType.TASK_ID, true, List.of(), false, "(?i)\\bFA-\\d+\\b")))
                .isInstanceOf(AccessDeniedException.class);
        org.mockito.Mockito.verifyNoInteractions(projects, rules);
    }
}
