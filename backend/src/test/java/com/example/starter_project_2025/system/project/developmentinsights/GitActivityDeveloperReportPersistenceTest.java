package com.example.starter_project_2025.system.project.developmentinsights;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequest;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitSyncStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource;
import com.example.starter_project_2025.system.project.developmentinsights.dto.GitActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitContributorRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityScope;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityScopeService;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityService;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@Import(GitActivityService.class)
@ActiveProfiles("test")
class GitActivityDeveloperReportPersistenceTest {
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired ProjectRepository projects;
    @Autowired GitRepositoryRepository repositories;
    @Autowired GitContributorRepository contributors;
    @Autowired GitCommitRepository commits;
    @Autowired GitPullRequestRepository pullRequests;
    @Autowired TaskGitLinkRepository links;
    @Autowired SprintBacklogRepository tasks;
    @Autowired SprintRepository sprints;
    @Autowired GitActivityService service;
    @MockBean GitActivityScopeService scopes;

    Project root;
    GitRepository repository;
    User mappedUser;
    User inactiveUser;
    GitContributor mapped;
    GitContributor unmapped;
    GitCommit commitOnSprintDay;
    GitCommit secondCommitOnSprintDay;
    GitCommit commitOutsideSprint;
    GitCommit unmappedCommitOutsideDay;
    GitPullRequest merged;
    GitPullRequest openUnmapped;
    Sprint sprint;
    SprintBacklog doneTask;
    SprintBacklog todoTask;

    @BeforeEach
    void setUp() {
        Tenant tenant = tenants.saveAndFlush(Tenant.builder()
                .code("GIT-REPORT-" + UUID.randomUUID()).name("Git report fixture").build());
        root = new Project();
        root.setCode("GIT-REPORT-ROOT-" + UUID.randomUUID());
        root.setName("Git report root");
        root.setTenant(tenant);
        root.setStatus(ProjectStatus.ACTIVE);
        root = projects.saveAndFlush(root);

        repository = new GitRepository();
        repository.setRootProject(root);
        repository.setExternalId(650_000L + root.getId());
        repository.setOwner("fixture");
        repository.setName("developer-report");
        repository.setFullName("fixture/developer-report");
        repository.setDefaultBranch("main");
        repository.setStatus(GitRepositoryStatus.ACTIVE);
        repository.setSyncStatus(GitSyncStatus.READY);
        repository.setMockData(false);
        repository = repositories.saveAndFlush(repository);

        mappedUser = saveUser(tenant, "Mapped", "Developer");
        inactiveUser = saveUser(tenant, "No", "Activity");
        mapped = saveContributor(810_000L + root.getId(), "mapped-dev", "Mapped Developer", mappedUser);
        unmapped = saveContributor(820_000L + root.getId(), "unmapped-dev", "Unmapped Dev", null);

        commitOnSprintDay = saveCommit("a".repeat(40), mapped, "2026-11-14T17:00:00Z");
        secondCommitOnSprintDay = saveCommit("b".repeat(40), mapped, "2026-11-15T01:00:00Z");
        commitOutsideSprint = saveCommit("c".repeat(40), mapped, "2026-11-14T08:00:00Z");
        unmappedCommitOutsideDay = saveCommit("d".repeat(40), unmapped, "2026-11-15T17:00:00Z");
        merged = savePullRequest(101, 910_001L + root.getId(), mapped, GitPullRequestState.MERGED,
                "2026-11-15T10:00:00Z", "2026-11-15T12:00:00Z");
        openUnmapped = savePullRequest(102, 910_002L + root.getId(), unmapped, GitPullRequestState.OPEN,
                "2026-11-16T10:00:00Z", null);

        sprint = new Sprint();
        sprint.setProjectId(root.getId());
        sprint.setName("Sprint HCM boundary");
        sprint.setSprintGoal("Verify time windows and traceability");
        sprint.setStartDate(LocalDateTime.parse("2026-11-15T00:00:00"));
        sprint.setEndDate(LocalDateTime.parse("2026-11-15T23:59:00"));
        sprint = sprints.saveAndFlush(sprint);
        doneTask = saveTask("Linked Task outside date", SprintBacklogStatus.DONE);
        doneTask.setSprint(sprint);
        doneTask = tasks.saveAndFlush(doneTask);
        todoTask = saveTask("Task without Git", SprintBacklogStatus.TODO);
        todoTask.setSprint(sprint);
        todoTask = tasks.saveAndFlush(todoTask);
        linkCommit(doneTask, commitOutsideSprint);
        linkPullRequest(doneTask, merged);

        var memberRows = List.of(
                new GitActivityScope.MemberIdentity(mappedUser.getId(), mappedUser.getFullName(),
                        mappedUser.getUsername(), Set.of(root.getId())),
                new GitActivityScope.MemberIdentity(inactiveUser.getId(), inactiveUser.getFullName(),
                        inactiveUser.getUsername(), Set.of(root.getId())));
        when(scopes.require(anyLong())).thenReturn(new GitActivityScope(null, root.getId(), Set.of(root.getId()),
                true, Set.of(mapped.getId(), unmapped.getId()), Map.of(root.getId(), Set.of(mapped.getId())),
                true, memberRows));
    }

    @Test
    void developerActivityCountsByIdentityAndIncludesNoActivityAndUnmappedRows() {
        var activity = service.developerActivity(94L, root.getId(), null, null, null);

        assertThat(activity.totalCommits()).isEqualTo(4);
        assertThat(activity.totalPullRequests()).isEqualTo(2);
        assertThat(activity.mergedPullRequests()).isEqualTo(1);
        assertThat(activity.developers()).filteredOn(row -> mappedUser.getId().equals(row.developerId()))
                .singleElement().satisfies(row -> {
                    assertThat(row.commits()).isEqualTo(3);
                    assertThat(row.pullRequests()).isEqualTo(1);
                    assertThat(row.mergedPullRequests()).isEqualTo(1);
                    assertThat(row.activeDays()).isEqualTo(2);
                    assertThat(row.noActivity()).isFalse();
                });
        assertThat(activity.developers()).filteredOn(row -> inactiveUser.getId().equals(row.developerId()))
                .singleElement().satisfies(row -> {
                    assertThat(row.commits()).isZero();
                    assertThat(row.pullRequests()).isZero();
                    assertThat(row.noActivity()).isTrue();
                });
        assertThat(activity.developers()).filteredOn(row -> row.unmapped())
                .extracting(row -> row.name()).containsExactly("Unmapped Dev");
    }

    @Test
    void developerAndHcmDateFiltersRecomputeCountsAndDistinctActivityDays() {
        var activity = service.developerActivity(94L, root.getId(), LocalDate.of(2026, 11, 15),
                LocalDate.of(2026, 11, 15), mappedUser.getId());

        assertThat(activity.totalCommits()).isEqualTo(2);
        assertThat(activity.totalPullRequests()).isEqualTo(1);
        assertThat(activity.mergedPullRequests()).isEqualTo(1);
        assertThat(activity.developers()).singleElement().satisfies(row -> {
            assertThat(row.developerId()).isEqualTo(mappedUser.getId());
            assertThat(row.activeDays()).isEqualTo(1);
            assertThat(row.lastActiveAt()).isEqualTo(Instant.parse("2026-11-15T12:00:00Z"));
        });
    }

    @Test
    void mergeAfterSelectedWindowDoesNotExtendDeveloperOrSprintActivity() {
        savePullRequest(103, 910_003L + root.getId(), mapped, GitPullRequestState.MERGED,
                "2026-11-15T10:00:00Z", "2026-11-16T12:00:00Z");
        savePullRequest(104, 910_004L + root.getId(), unmapped, GitPullRequestState.MERGED,
                "2026-11-14T10:00:00Z", "2026-11-15T12:00:00Z");

        var activity = service.developerActivity(94L, root.getId(), LocalDate.of(2026, 11, 15),
                LocalDate.of(2026, 11, 15), mappedUser.getId());
        assertThat(activity.totalPullRequests()).isEqualTo(2);
        assertThat(activity.mergedPullRequests()).isEqualTo(1);
        assertThat(activity.developers()).singleElement().satisfies(row -> {
            assertThat(row.pullRequests()).isEqualTo(2);
            assertThat(row.mergedPullRequests()).isEqualTo(1);
            assertThat(row.activeDays()).isEqualTo(1);
            assertThat(row.lastActiveAt()).isEqualTo(Instant.parse("2026-11-15T12:00:00Z"));
        });

        var sprintReport = service.sprintDevelopmentReport(94L, sprint.getId());
        assertThat(sprintReport.gitActivity().totalPullRequests()).isEqualTo(2);
        assertThat(sprintReport.gitActivity().mergedPullRequests()).isEqualTo(2);
        assertThat(sprintReport.developerActivity()).filteredOn(row -> mappedUser.getId().equals(row.developerId()))
                .singleElement().satisfies(row -> {
                    assertThat(row.pullRequests()).isEqualTo(2);
                    assertThat(row.mergedPullRequests()).isEqualTo(1);
                    assertThat(row.activeDays()).isEqualTo(1);
                    assertThat(row.lastActiveAt()).isEqualTo(Instant.parse("2026-11-15T12:00:00Z"));
                });
        assertThat(sprintReport.developerActivity()).filteredOn(row -> row.unmapped())
                .singleElement().satisfies(row -> {
                    assertThat(row.pullRequests()).isZero();
                    assertThat(row.mergedPullRequests()).isEqualTo(1);
                    assertThat(row.activeDays()).isEqualTo(1);
                    assertThat(row.lastActiveAt()).isEqualTo(Instant.parse("2026-11-15T12:00:00Z"));
                    assertThat(row.noActivity()).isFalse();
                });
    }

    @Test
    void contributorMappingChangeMovesActivityToMemberOnRefresh() {
        var before = service.developerActivity(94L, root.getId(), null, null, null);
        assertThat(before.developers()).filteredOn(row -> row.unmapped())
                .extracting(row -> row.name()).containsExactly("Unmapped Dev");

        unmapped.setUser(inactiveUser);
        contributors.saveAndFlush(unmapped);
        var after = service.developerActivity(94L, root.getId(), null, null, null);

        assertThat(after.developers()).noneMatch(row -> row.unmapped() && "Unmapped Dev".equals(row.name()));
        assertThat(after.developers()).filteredOn(row -> inactiveUser.getId().equals(row.developerId()))
                .singleElement().satisfies(row -> {
                    assertThat(row.commits()).isEqualTo(1);
                    assertThat(row.pullRequests()).isEqualTo(1);
                    assertThat(row.noActivity()).isFalse();
                });
    }

    @Test
    void sprintReportUsesSprintDatesForGitButAllSprintTaskLinksForTraceability() {
        var report = service.sprintDevelopmentReport(94L, sprint.getId());

        assertThat(report.sprintOverview().totalTasks()).isEqualTo(2);
        assertThat(report.sprintOverview().doneTasks()).isEqualTo(1);
        assertThat(report.sprintOverview().todoTasks()).isEqualTo(1);
        assertThat(report.gitActivity().totalCommits()).isEqualTo(2);
        assertThat(report.gitActivity().totalPullRequests()).isEqualTo(1);
        assertThat(report.taskTraceability().tasksWithCommits()).isEqualTo(1);
        assertThat(report.taskTraceability().tasksWithPullRequests()).isEqualTo(1);
        assertThat(report.taskTraceability().tasksWithoutGitActivity()).isEqualTo(1);
    }

    @Test
    void emptySprintStillReturnsOverviewAndZeroGitMetrics() {
        Sprint emptySprint = new Sprint();
        emptySprint.setProjectId(root.getId());
        emptySprint.setName("Future empty Sprint");
        emptySprint.setSprintGoal("No synced activity");
        emptySprint.setStartDate(LocalDateTime.parse("2026-11-25T00:00:00"));
        emptySprint.setEndDate(LocalDateTime.parse("2026-12-08T23:59:00"));
        emptySprint = sprints.saveAndFlush(emptySprint);
        Long emptySprintId = emptySprint.getId();

        var report = service.sprintDevelopmentReport(94L, emptySprintId);

        assertThat(report.sprintOverview().name()).isEqualTo("Future empty Sprint");
        assertThat(report.gitActivity().totalCommits()).isZero();
        assertThat(report.gitActivity().totalPullRequests()).isZero();
    }

    @Test
    void sprintFromAnotherProjectIsRejected() {
        Project otherProject = new Project();
        otherProject.setCode("GIT-REPORT-OTHER-" + UUID.randomUUID());
        otherProject.setName("Other report root");
        otherProject.setTenant(root.getTenant());
        otherProject.setStatus(ProjectStatus.ACTIVE);
        otherProject = projects.saveAndFlush(otherProject);
        Sprint otherSprint = new Sprint();
        otherSprint.setProjectId(otherProject.getId());
        otherSprint.setName("Other Sprint");
        otherSprint.setSprintGoal("Scope denial");
        otherSprint.setStartDate(LocalDateTime.parse("2026-11-15T00:00:00"));
        otherSprint.setEndDate(LocalDateTime.parse("2026-11-28T23:59:00"));
        otherSprint = sprints.saveAndFlush(otherSprint);
        Long otherSprintId = otherSprint.getId();

        assertThatThrownBy(() -> service.sprintDevelopmentReport(94L, otherSprintId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void projectReportAppliesDeveloperDateAndSprintFiltersAndReportsMissingRepository() {
        var report = service.projectDevelopmentReport(94L, root.getId(), null,
                LocalDate.of(2026, 11, 15), LocalDate.of(2026, 11, 15), mappedUser.getId());

        assertThat(report.repositoryConfigured()).isTrue();
        assertThat(report.gitActivity().totalCommits()).isEqualTo(2);
        assertThat(report.gitActivity().totalPullRequests()).isEqualTo(1);
        assertThat(report.developerActivity()).singleElement().satisfies(row -> {
            assertThat(row.developerId()).isEqualTo(mappedUser.getId());
            assertThat(row.activeDays()).isEqualTo(1);
        });

        saveTask("Task outside selected Sprint", SprintBacklogStatus.TODO);
        saveCommit("e".repeat(40), mapped, "2026-11-16T10:00:00Z");
        savePullRequest(105, 910_005L + root.getId(), mapped, GitPullRequestState.OPEN,
                "2026-11-16T10:00:00Z", null);
        savePullRequest(106, 910_006L + root.getId(), unmapped, GitPullRequestState.MERGED,
                "2026-11-14T10:00:00Z", "2026-11-15T13:00:00Z");
        var mergeOnlyReport = service.projectDevelopmentReport(94L, root.getId(), null,
                LocalDate.of(2026, 11, 15), LocalDate.of(2026, 11, 15), null);
        assertThat(mergeOnlyReport.gitActivity().totalPullRequests()).isEqualTo(1);
        assertThat(mergeOnlyReport.gitActivity().mergedPullRequests()).isEqualTo(2);
        assertThat(mergeOnlyReport.developerActivity()).filteredOn(row -> row.unmapped())
                .singleElement().satisfies(row -> {
                    assertThat(row.pullRequests()).isZero();
                    assertThat(row.mergedPullRequests()).isEqualTo(1);
                    assertThat(row.noActivity()).isFalse();
                });

        var sprintFiltered = service.projectDevelopmentReport(94L, root.getId(), sprint.getId(), null,
                null, null);
        assertThat(sprintFiltered.totalTasks()).isEqualTo(2);
        assertThat(sprintFiltered.gitActivity().totalCommits()).isEqualTo(2);
        assertThat(sprintFiltered.gitActivity().totalPullRequests()).isEqualTo(1);
        assertThat(sprintFiltered.gitActivity().mergedPullRequests()).isEqualTo(2);

        var linkedRepositoryWithoutActivity = service.projectDevelopmentReport(94L, root.getId(), null,
                LocalDate.of(2026, 12, 30), LocalDate.of(2026, 12, 30), null);
        assertThat(linkedRepositoryWithoutActivity.repositoryConfigured()).isTrue();
        assertThat(linkedRepositoryWithoutActivity.totalTasks()).isEqualTo(3);
        assertThat(linkedRepositoryWithoutActivity.gitActivity().totalCommits()).isZero();
        assertThat(linkedRepositoryWithoutActivity.gitActivity().totalPullRequests()).isZero();
        assertThat(linkedRepositoryWithoutActivity.gitActivity().mergedPullRequests()).isZero();

        repositories.delete(repository);
        repositories.flush();
        var noRepository = service.projectDevelopmentReport(94L, root.getId(), null, null, null, null);
        assertThat(noRepository.repositoryConfigured()).isFalse();
        assertThat(noRepository.repositoryName()).isNull();
    }

    @Test
    void rootProjectReportIncludesClusterTasksAndModuleSprints() {
        Project module = new Project();
        module.setCode("GIT-REPORT-MODULE-" + UUID.randomUUID());
        module.setName("Git report module");
        module.setTenant(root.getTenant());
        module.setParentProject(root);
        module.setStatus(ProjectStatus.ACTIVE);
        module = projects.saveAndFlush(module);

        Sprint moduleSprint = new Sprint();
        moduleSprint.setProjectId(module.getId());
        moduleSprint.setName("Module Sprint");
        moduleSprint.setSprintGoal("Root report includes child scope");
        moduleSprint.setStartDate(LocalDateTime.parse("2026-11-15T00:00:00"));
        moduleSprint.setEndDate(LocalDateTime.parse("2026-11-15T23:59:00"));
        moduleSprint = sprints.saveAndFlush(moduleSprint);
        Long moduleSprintId = moduleSprint.getId();

        SprintBacklog moduleTask = new SprintBacklog();
        moduleTask.setProjectId(module.getId());
        moduleTask.setTitle("Module scoped task");
        moduleTask.setStatus(SprintBacklogStatus.TODO);
        moduleTask.setSprint(moduleSprint);
        tasks.saveAndFlush(moduleTask);

        saveCommit("f".repeat(40), mapped, "2026-11-15T05:00:00Z");
        savePullRequest(107, 910_007L + root.getId(), mapped, GitPullRequestState.OPEN,
                "2026-11-15T06:00:00Z", null);

        when(scopes.require(anyLong())).thenReturn(new GitActivityScope(null, root.getId(),
                Set.of(root.getId(), module.getId()), true, Set.of(mapped.getId(), unmapped.getId()),
                Map.of(root.getId(), Set.of(mapped.getId()), module.getId(), Set.of(mapped.getId())),
                true, List.of(
                new GitActivityScope.MemberIdentity(mappedUser.getId(), mappedUser.getFullName(),
                        mappedUser.getUsername(), Set.of(root.getId(), module.getId())),
                new GitActivityScope.MemberIdentity(inactiveUser.getId(), inactiveUser.getFullName(),
                        inactiveUser.getUsername(), Set.of(root.getId())))));

        var options = service.reportOptions(94L, root.getId());
        assertThat(options.sprints()).extracting(GitActivityDtos.SprintOption::id).contains(moduleSprintId);

        var rootReport = service.projectDevelopmentReport(94L, root.getId(), null, null, null, null);
        assertThat(rootReport.totalTasks()).isEqualTo(3);
        assertThat(rootReport.todoTasks()).isEqualTo(2);

        var moduleSprintReport = service.projectDevelopmentReport(94L, root.getId(), moduleSprintId,
                null, null, null);
        assertThat(moduleSprintReport.projectId()).isEqualTo(module.getId());
        assertThat(moduleSprintReport.totalTasks()).isEqualTo(1);
        assertThat(moduleSprintReport.gitActivity().totalCommits()).isEqualTo(3);
        // This module sprint includes the unlinked PR by a module contributor, but not the PR
        // linked to a task in the root project.
        assertThat(moduleSprintReport.gitActivity().totalPullRequests()).isEqualTo(1);
    }

    private User saveUser(Tenant tenant, String firstName, String lastName) {
        return users.saveAndFlush(User.builder().email(UUID.randomUUID() + "@example.test")
                .passwordHash("fixture-hash").firstName(firstName).lastName(lastName)
                .tenantId(tenant.getId()).username((firstName + lastName).toLowerCase()).build());
    }

    private GitContributor saveContributor(Long externalId, String login, String name, User user) {
        GitContributor contributor = new GitContributor();
        contributor.setRootProject(root);
        contributor.setExternalId(externalId);
        contributor.setLogin(login);
        contributor.setDisplayName(name);
        contributor.setUser(user);
        return contributors.saveAndFlush(contributor);
    }

    private GitCommit saveCommit(String sha, GitContributor author, String at) {
        GitCommit commit = new GitCommit();
        commit.setRepository(repository);
        commit.setSha(sha);
        commit.setMessage("feat: fixture commit");
        commit.setAuthorContributor(author);
        commit.setCommittedAt(Instant.parse(at));
        commit.setFirstSeenBranch("main");
        return commits.saveAndFlush(commit);
    }

    private GitPullRequest savePullRequest(int number, Long externalId, GitContributor author,
                                            GitPullRequestState state, String createdAt, String mergedAt) {
        GitPullRequest pullRequest = new GitPullRequest();
        pullRequest.setRepository(repository);
        pullRequest.setNumber(number);
        pullRequest.setExternalId(externalId);
        pullRequest.setTitle("Fixture PR " + number);
        pullRequest.setBody("Report fixture");
        pullRequest.setAuthorContributor(author);
        pullRequest.setState(state);
        pullRequest.setSourceBranch("feature/report");
        pullRequest.setTargetBranch("main");
        pullRequest.setCreatedAt(Instant.parse(createdAt));
        pullRequest.setSourceUpdatedAt(mergedAt == null ? Instant.parse(createdAt) : Instant.parse(mergedAt));
        pullRequest.setMergedAt(mergedAt == null ? null : Instant.parse(mergedAt));
        return pullRequests.saveAndFlush(pullRequest);
    }

    private SprintBacklog saveTask(String title, SprintBacklogStatus status) {
        SprintBacklog task = new SprintBacklog();
        task.setProjectId(root.getId());
        task.setTitle(title);
        task.setStatus(status);
        return tasks.saveAndFlush(task);
    }

    private void linkCommit(SprintBacklog task, GitCommit commit) {
        TaskGitLink link = new TaskGitLink();
        link.setTask(task);
        link.setCommit(commit);
        link.setSource(TaskGitLinkSource.AUTO);
        link.setLinkedAt(commit.getCommittedAt());
        links.saveAndFlush(link);
    }

    private void linkPullRequest(SprintBacklog task, GitPullRequest pullRequest) {
        TaskGitLink link = new TaskGitLink();
        link.setTask(task);
        link.setPullRequest(pullRequest);
        link.setSource(TaskGitLinkSource.AUTO);
        link.setLinkedAt(pullRequest.getCreatedAt());
        links.saveAndFlush(link);
    }
}
