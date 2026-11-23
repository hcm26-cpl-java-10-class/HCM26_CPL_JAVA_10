package com.example.starter_project_2025.system.project.developmentinsights.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.developmentinsights.domain.*;
import com.example.starter_project_2025.system.project.developmentinsights.dto.GitUnmappedActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.repository.*;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceRosterService;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class GitUnmappedActivityServiceTest {
    private GitActivityScopeService scopes;
    private GitRepositoryRepository repositories;
    private GitCommitRepository commits;
    private GitPullRequestRepository pullRequests;
    private TaskGitLinkRepository links;
    private GitCommitValidationResultRepository validations;
    private GitDevelopmentRuleRepository rules;
    private GitTaskReferenceResolver taskReferences;
    private SprintBacklogRepository tasks;
    private ProjectRepository projects;
    private WorkspaceAccessService access;
    private WorkspaceRosterService roster;
    private GitUnmappedActivityService service;
    private Workspace workspace;
    private GitRepository repository;
    private GitCommit commit;
    private GitPullRequest pullRequest;
    private User admin;
    private SprintBacklog task;

    @BeforeEach
    void setUp() {
        scopes = mock(GitActivityScopeService.class);
        repositories = mock(GitRepositoryRepository.class);
        commits = mock(GitCommitRepository.class);
        pullRequests = mock(GitPullRequestRepository.class);
        links = mock(TaskGitLinkRepository.class);
        validations = mock(GitCommitValidationResultRepository.class);
        rules = mock(GitDevelopmentRuleRepository.class);
        taskReferences = mock(GitTaskReferenceResolver.class);
        tasks = mock(SprintBacklogRepository.class);
        projects = mock(ProjectRepository.class);
        access = mock(WorkspaceAccessService.class);
        roster = mock(WorkspaceRosterService.class);
        service = new GitUnmappedActivityService(scopes, repositories, commits, pullRequests, links,
                validations, rules, taskReferences, tasks, projects, access, roster);
        workspace = mock(Workspace.class);
        when(workspace.getTaskKeyPrefix()).thenReturn("FA");
        when(scopes.require(3L)).thenReturn(new GitActivityScope(workspace, 10L, Set.of(10L), true,
                Set.of(), java.util.Map.of(), true));
        Role adminRole = mock(Role.class);
        when(adminRole.getName()).thenReturn("ADMIN");
        when(adminRole.getIsActive()).thenReturn(true);
        admin = mock(User.class);
        when(admin.getId()).thenReturn(7L);
        when(admin.getRoles()).thenReturn(Set.of(adminRole));
        when(admin.getFullName()).thenReturn("Workspace Admin");
        when(access.requireUser(false)).thenReturn(admin);

        repository = mock(GitRepository.class);
        when(repository.getId()).thenReturn(4L);
        when(repository.isMockData()).thenReturn(false);
        when(repositories.findAllByRootProject_IdOrderByIdAsc(10L)).thenReturn(List.of(repository));

        commit = mock(GitCommit.class);
        when(commit.getId()).thenReturn(51L);
        when(commit.getSha()).thenReturn("sha-51");
        when(commit.getMessage()).thenReturn("fix: resolve task FA-51");
        when(commit.getCommittedAt()).thenReturn(Instant.parse("2026-11-20T10:00:00Z"));
        when(commit.getHtmlUrl()).thenReturn("https://github.com/example/repo/commit/sha-51");
        when(commits.findAllByRepository_IdInOrderByCommittedAtAscIdAsc(anyCollection())).thenReturn(List.of(commit));
        when(commits.findInRoot(10L, 51L)).thenReturn(Optional.of(commit));

        pullRequest = mock(GitPullRequest.class);
        when(pullRequest.getId()).thenReturn(61L);
        when(pullRequest.getNumber()).thenReturn(8);
        when(pullRequest.getTitle()).thenReturn("Fix backlog links");
        when(pullRequest.getBody()).thenReturn("Reference FA-51");
        when(pullRequest.getCreatedAt()).thenReturn(Instant.parse("2026-11-20T11:00:00Z"));
        when(pullRequest.getState()).thenReturn(GitPullRequestState.OPEN);
        when(pullRequest.getHtmlUrl()).thenReturn("https://github.com/example/repo/pull/8");
        when(pullRequests.findAllByRepository_IdOrderByCreatedAtAscIdAsc(4L)).thenReturn(List.of(pullRequest));
        when(pullRequests.findInRoot(10L, 61L)).thenReturn(Optional.of(pullRequest));
        when(taskReferences.resolve(eq(10L), anyString(), anyString())).thenReturn(
                new GitTaskReferenceResolver.Resolution(GitCommitValidationStatus.MISSING,
                        "No Task Key found.", List.of()));
        when(validations.findAllByCommit_IdOrderByEvaluatedAtDescIdDesc(51L)).thenReturn(List.of());

        task = mock(SprintBacklog.class);
        when(task.getId()).thenReturn(31L);
        when(task.getProjectId()).thenReturn(10L);
        when(task.getTitle()).thenReturn("Implement Git reporting");
        when(task.getIsActive()).thenReturn(true);
        when(tasks.findById(31L)).thenReturn(Optional.of(task));
        when(links.saveAndFlush(any(TaskGitLink.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void listsCommitAndPullRequestWithReasonsAndAppliesTypeAndDateFilters() {
        var all = service.list(3L, GitUnmappedActivityDtos.ActivityType.ALL, null, null, null, 0, 20);
        var commitsOnly = service.list(3L, GitUnmappedActivityDtos.ActivityType.COMMIT,
                LocalDate.parse("2026-11-20"), LocalDate.parse("2026-11-20"), null, 0, 20);
        var outsideDate = service.list(3L, GitUnmappedActivityDtos.ActivityType.ALL,
                LocalDate.parse("2026-11-19"), LocalDate.parse("2026-11-19"), null, 0, 20);

        assertThat(all.activities().getContent()).extracting(GitUnmappedActivityDtos.Item::type)
                .containsExactly(GitUnmappedActivityDtos.ActivityType.PULL_REQUEST,
                        GitUnmappedActivityDtos.ActivityType.COMMIT);
        assertThat(all.activities().getContent()).allSatisfy(item -> assertThat(item.reason()).contains("Task ID"));
        assertThat(commitsOnly.activities().getContent()).singleElement().satisfies(item -> {
            assertThat(item.sha()).isEqualTo("sha-51");
            assertThat(item.htmlUrl()).contains("commit/sha-51");
        });
        assertThat(outsideDate.activities().getTotalElements()).isZero();
        assertThat(all.canManage()).isTrue();
    }

    @Test
    void managerCanManuallyLinkAnUnmappedActivityToAnInScopeTaskWithAuditSource() {
        var result = service.link(3L, new GitUnmappedActivityDtos.LinkInput(
                GitUnmappedActivityDtos.ActivityType.COMMIT, 51L, 31L));

        ArgumentCaptor<TaskGitLink> captured = ArgumentCaptor.forClass(TaskGitLink.class);
        org.mockito.Mockito.verify(links).saveAndFlush(captured.capture());
        assertThat(captured.getValue().getSource()).isEqualTo(TaskGitLinkSource.MANUAL);
        assertThat(captured.getValue().getLinkedBy()).isSameAs(admin);
        assertThat(captured.getValue().getLinkedAt()).isNotNull();
        assertThat(result.taskId()).isEqualTo(31L);
        assertThat(result.projectId()).isEqualTo(10L);

        when(links.findAllByCommit_IdIn(anyCollection())).thenReturn(List.of(captured.getValue()));
        var refreshed = service.list(3L, GitUnmappedActivityDtos.ActivityType.ALL, null, null, null, 0, 20);
        assertThat(refreshed.activities().getContent())
                .extracting(GitUnmappedActivityDtos.Item::type)
                .containsExactly(GitUnmappedActivityDtos.ActivityType.PULL_REQUEST);
    }

    @Test
    void userWithoutWorkspaceManagementPermissionCannotManuallyLink() {
        User member = mock(User.class);
        when(member.getId()).thenReturn(8L);
        when(member.getRoles()).thenReturn(Set.of());
        when(access.requireUser(false)).thenReturn(member);

        assertThatThrownBy(() -> service.link(3L, new GitUnmappedActivityDtos.LinkInput(
                GitUnmappedActivityDtos.ActivityType.COMMIT, 51L, 31L)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(links, org.mockito.Mockito.never()).saveAndFlush(any(TaskGitLink.class));
    }

    @Test
    void managerCannotLinkToATaskOutsideTheVisibleProjectScope() {
        when(task.getProjectId()).thenReturn(11L);

        assertThatThrownBy(() -> service.link(3L, new GitUnmappedActivityDtos.LinkInput(
                GitUnmappedActivityDtos.ActivityType.COMMIT, 51L, 31L)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(links, org.mockito.Mockito.never()).saveAndFlush(any(TaskGitLink.class));
    }

    @Test
    void projectManagerCanManuallyLinkAPullRequestToAnInScopeTask() {
        ProjectTeam team = mock(ProjectTeam.class);
        when(workspace.getTeam()).thenReturn(team);
        ClassMember classMember = mock(ClassMember.class);
        User manager = mock(User.class);
        when(manager.getId()).thenReturn(9L);
        when(manager.getFullName()).thenReturn("Project Manager");
        when(classMember.getUser()).thenReturn(manager);
        ProjectMember member = mock(ProjectMember.class);
        when(member.getClassMember()).thenReturn(classMember);
        when(member.getRole()).thenReturn("PM");
        when(roster.current(team)).thenReturn(List.of(member));
        when(access.requireUser(false)).thenReturn(manager);

        var result = service.link(3L, new GitUnmappedActivityDtos.LinkInput(
                GitUnmappedActivityDtos.ActivityType.PULL_REQUEST, 61L, 31L));

        ArgumentCaptor<TaskGitLink> captured = ArgumentCaptor.forClass(TaskGitLink.class);
        verify(links).saveAndFlush(captured.capture());
        assertThat(captured.getValue().getSource()).isEqualTo(TaskGitLinkSource.MANUAL);
        assertThat(captured.getValue().getLinkedBy()).isSameAs(manager);
        assertThat(result.type()).isEqualTo(GitUnmappedActivityDtos.ActivityType.PULL_REQUEST);
        assertThat(result.activityId()).isEqualTo(61L);
        assertThat(result.taskId()).isEqualTo(31L);
    }
}
