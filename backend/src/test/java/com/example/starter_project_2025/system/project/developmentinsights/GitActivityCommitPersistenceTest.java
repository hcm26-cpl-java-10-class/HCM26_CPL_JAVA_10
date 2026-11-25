package com.example.starter_project_2025.system.project.developmentinsights;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitSyncStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource;
import com.example.starter_project_2025.system.project.developmentinsights.dto.GitActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitContributorRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityScope;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityScopeService;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityService;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@Import(GitActivityService.class)
@ActiveProfiles("test")
class GitActivityCommitPersistenceTest {
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired ProjectRepository projects;
    @Autowired GitRepositoryRepository repositories;
    @Autowired GitContributorRepository contributors;
    @Autowired GitCommitRepository commits;
    @Autowired TaskGitLinkRepository links;
    @Autowired SprintBacklogRepository tasks;
    @Autowired EntityManager entityManager;
    @Autowired GitActivityService service;
    @MockBean GitActivityScopeService scopes;

    Project root;
    Project module;
    GitRepository repository;
    GitContributor mappedAuthor;
    SprintBacklog task;
    GitCommit linkedCommit;
    GitCommit olderCommit;

    @BeforeEach
    void setUp() {
        Tenant tenant = tenants.saveAndFlush(Tenant.builder()
                .code("GIT-" + UUID.randomUUID()).name("Git Activity fixture").build());
        root = new Project();
        root.setCode("GIT-ROOT-" + UUID.randomUUID());
        root.setName("Git Activity root");
        root.setTenant(tenant);
        root.setStatus(ProjectStatus.ACTIVE);
        root = projects.saveAndFlush(root);

        module = new Project();
        module.setCode("GIT-MODULE-" + UUID.randomUUID());
        module.setName("Git Activity module");
        module.setTenant(tenant);
        module.setStatus(ProjectStatus.ACTIVE);
        module.setParentProject(root);
        module = projects.saveAndFlush(module);

        repository = new GitRepository();
        repository.setRootProject(root);
        repository.setExternalId(500_000L + root.getId());
        repository.setOwner("fixture");
        repository.setName("activity-test");
        repository.setFullName("fixture/activity-test");
        repository.setHtmlUrl("https://github.com/fixture/activity-test");
        repository.setDefaultBranch("main");
        repository.setStatus(GitRepositoryStatus.ACTIVE);
        repository.setSyncStatus(GitSyncStatus.READY);
        repository.setMockData(true);
        repository = repositories.saveAndFlush(repository);

        User mappedUser = User.builder()
                .email("git-activity-" + UUID.randomUUID() + "@example.test")
                .passwordHash("test-password-hash")
                .firstName("Fixture")
                .lastName("Developer")
                .tenantId(tenant.getId())
                .build();
        mappedUser = users.saveAndFlush(mappedUser);

        mappedAuthor = new GitContributor();
        mappedAuthor.setRootProject(root);
        mappedAuthor.setExternalId(800_000L + root.getId());
        mappedAuthor.setLogin("fixture-dev");
        mappedAuthor.setDisplayName("Fixture Developer");
        mappedAuthor.setUser(mappedUser);
        mappedAuthor = contributors.saveAndFlush(mappedAuthor);

        task = new SprintBacklog();
        task.setProjectId(module.getId());
        task.setTitle("Linked fixture task");
        task = tasks.saveAndFlush(task);

        linkedCommit = commit("a".repeat(40), "feat: visible linked commit", Instant.parse("2026-11-15T10:00:00Z"));
        olderCommit = commit("b".repeat(40), "fix: alpha searchable history", Instant.parse("2026-11-13T10:00:00Z"));
        TaskGitLink taskLink = new TaskGitLink();
        taskLink.setTask(task);
        taskLink.setCommit(linkedCommit);
        taskLink.setSource(TaskGitLinkSource.AUTO);
        taskLink.setLinkedAt(linkedCommit.getCommittedAt());
        links.saveAndFlush(taskLink);

        when(scopes.require(anyLong())).thenAnswer(invocation ->
                new GitActivityScope(null, root.getId(), Set.of(root.getId(), module.getId()), true,
                        Set.of(), Map.of(), true));
    }

    @Test
    void taskContextReturnsOnlyTheAuthorizedActiveTask() {
        var context = service.taskContext(91L, task.getId());
        assertThat(context.taskId()).isEqualTo(task.getId());
        assertThat(context.projectId()).isEqualTo(module.getId());
        assertThat(context.projectName()).isEqualTo(module.getName());
        assertThat(context.title()).isEqualTo("Linked fixture task");
        task.setIsActive(false);
        tasks.saveAndFlush(task);
        assertThatThrownBy(() -> service.taskContext(91L, task.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode().value()).isEqualTo(404));
    }

    @Test
    void taskContextRejectsMissingTaskPermissionAndTasksOutsideTheWorkspace() {
        when(scopes.require(anyLong())).thenReturn(new GitActivityScope(null, root.getId(),
                Set.of(root.getId(), module.getId()), true, Set.of(), Map.of(), false));
        assertThatThrownBy(() -> service.taskContext(91L, task.getId())).isInstanceOf(AccessDeniedException.class);
        when(scopes.require(anyLong())).thenReturn(new GitActivityScope(null, root.getId(),
                Set.of(root.getId()), true, Set.of(), Map.of(), true));
        assertThatThrownBy(() -> service.taskContext(91L, task.getId()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode().value()).isEqualTo(404));
    }

    @Test
    void commitHistorySearchSortsAndPaginatesTheCompleteH2Fixture() {
        var oldest = service.commits(91L, "alpha", "oldest", 0, 1, null, null, null, null, null);
        assertThat(oldest.getTotalElements()).isEqualTo(1);
        assertThat(oldest.getContent()).singleElement().satisfies(item -> {
            assertThat(item.sha()).isEqualTo(olderCommit.getSha());
            assertThat(item.authorName()).isEqualTo("Fixture Developer");
            assertThat(item.committedAt()).isEqualTo(olderCommit.getCommittedAt());
        });

        var page = service.commits(91L, null, "newest", 0, 1, null, null, null, null, null);
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getTotalPages()).isEqualTo(2);
        assertThat(page.getContent()).singleElement().satisfies(item -> assertThat(item.sha()).isEqualTo(linkedCommit.getSha()));
    }

    @Test
    void commitDetailsIncludeLinkedTaskAndSourceUrlAndRepositoryStatusMarksMockData() {
        GitActivityDtos.CommitDetails details = service.commit(91L, linkedCommit.getId());
        assertThat(details.htmlUrl()).isEqualTo(linkedCommit.getHtmlUrl());
        assertThat(details.tasks()).containsExactly(new GitActivityDtos.TaskLink(
                task.getId(), module.getId(), task.getTitle(), TaskGitLinkSource.AUTO));
        assertThat(service.status(91L)).satisfies(status -> {
            assertThat(status.connected()).isTrue();
            assertThat(status.repositoryUrl()).isEqualTo(repository.getHtmlUrl());
            assertThat(status.mockData()).isTrue();
        });
    }

    @Test
    void moduleScopeOnlyReturnsLinkedCommitsForItsTasks() {
        when(scopes.require(91L)).thenReturn(new GitActivityScope(
                null, root.getId(), Set.of(module.getId()), false, Set.of(), Map.of(), true));
        var visible = service.commits(91L, null, "newest", 0, 20, null, null, null, null, null);
        assertThat(visible.getTotalElements()).isEqualTo(1);
        assertThat(visible.getContent()).extracting(GitActivityDtos.CommitItem::id).containsExactly(linkedCommit.getId());
        assertThatThrownBy(() -> service.commit(91L, olderCommit.getId()))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void taskFilterReturnsOnlyLinkedCommitAndAnEmptyPageForAnotherTask() {
        SprintBacklog otherTask = new SprintBacklog();
        otherTask.setProjectId(module.getId());
        otherTask.setTitle("Task without Git Activity");
        otherTask = tasks.saveAndFlush(otherTask);

        var linkedPage = service.commits(91L, null, "newest", 0, 5, null, task.getId(), null, null, null);
        var emptyPage = service.commits(91L, null, "newest", 0, 5, null, otherTask.getId(), null, null, null);
        var linkedAnalytics = service.commitAnalytics(91L, "day", null, task.getId(), null,
                null, null, null, null, null, false, false);
        var emptyAnalytics = service.commitAnalytics(91L, "day", null, otherTask.getId(), null,
                null, null, null, null, null, false, false);

        assertThat(linkedPage.getTotalElements()).isEqualTo(1);
        assertThat(linkedPage.getContent()).extracting(GitActivityDtos.CommitItem::id)
                .containsExactly(linkedCommit.getId());
        assertThat(emptyPage.getTotalElements()).isZero();
        assertThat(emptyPage.getContent()).isEmpty();
        assertThat(linkedAnalytics.totalCommits()).isEqualTo(1);
        assertThat(emptyAnalytics.totalCommits()).isZero();
    }

    @Test
    void projectAndDateFiltersRunBeforePaginationAndOptionsRespectWorkspaceScope() {
        var page = service.commits(91L, null, "oldest", 0, 1, module.getId(), null,
                null, LocalDate.of(2026, 11, 15), LocalDate.of(2026, 11, 15));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent()).extracting(GitActivityDtos.CommitItem::id).containsExactly(linkedCommit.getId());
        var options = service.filterOptions(91L, module.getId());
        assertThat(options.projects()).extracting(GitActivityDtos.FilterProject::id)
                .containsExactlyInAnyOrder(root.getId(), module.getId());
        assertThat(options.developers()).extracting(GitActivityDtos.FilterDeveloper::name)
                .containsExactly("Fixture Developer");
    }

    @Test
    void commitAnalyticsCountsUniqueCommitsAndFiltersBotsMergesDevelopersAndFirstSeenBranches() {
        SprintBacklog secondTask = new SprintBacklog();
        secondTask.setProjectId(module.getId());
        secondTask.setTitle("Second linked task");
        secondTask = tasks.saveAndFlush(secondTask);
        TaskGitLink duplicateLink = new TaskGitLink();
        duplicateLink.setTask(secondTask);
        duplicateLink.setCommit(linkedCommit);
        duplicateLink.setSource(TaskGitLinkSource.AUTO);
        duplicateLink.setLinkedAt(linkedCommit.getCommittedAt());
        links.saveAndFlush(duplicateLink);

        GitContributor botAuthor = contributor("fixture-bot", "Fixture Bot", true, null);
        GitCommit botCommit = commit("c".repeat(40), "chore: update dependencies",
                Instant.parse("2026-11-15T11:00:00Z"));
        botCommit.setAuthorContributor(botAuthor);
        botCommit.setBot(true);
        commits.saveAndFlush(botCommit);
        GitCommit mergeCommit = commit("d".repeat(40), "Merge pull request #1",
                Instant.parse("2026-11-15T12:00:00Z"));
        mergeCommit.setMergeCommit(true);
        commits.saveAndFlush(mergeCommit);
        User secondUser = User.builder()
                .email("git-activity-second-" + UUID.randomUUID() + "@example.test")
                .passwordHash("test-password-hash")
                .firstName("Second")
                .lastName("Developer")
                .tenantId(root.getTenantId())
                .build();
        secondUser = users.saveAndFlush(secondUser);
        GitContributor secondAuthor = contributor("second-dev", "Second Developer", false, secondUser);
        GitCommit secondDeveloperCommit = commit("8".repeat(40), "feat: second developer contribution",
                Instant.parse("2026-11-15T13:00:00Z"));
        secondDeveloperCommit.setAuthorContributor(secondAuthor);
        secondDeveloperCommit.setFirstSeenBranch("feature/second-dev");
        commits.saveAndFlush(secondDeveloperCommit);

        var defaults = service.commitAnalytics(91L, "day", null, null, null, null,
                null, null, null, null, false, false);
        assertThat(defaults.totalCommits()).isEqualTo(3);
        assertThat(defaults.trend()).extracting(GitActivityDtos.CommitTrendPoint::commits)
                .containsExactly(1L, 2L);
        assertThat(defaults.developers()).hasSize(2).anySatisfy(row -> {
            assertThat(row.name()).isEqualTo("Fixture Developer");
            assertThat(row.developerId()).isNotNull();
            assertThat(row.commits()).isEqualTo(2);
        });
        assertThat(defaults.branches()).hasSize(2).anySatisfy(row -> {
            assertThat(row.label()).isEqualTo("main");
            assertThat(row.commits()).isEqualTo(2);
        });
        assertThat(defaults.branchOptions()).containsExactly("feature/second-dev", "main");

        var selectedDeveloper = service.commitAnalytics(91L, "day", null, null,
                defaults.developers().get(0).developerId(), null, null, null,
                null, null, false, false);
        assertThat(selectedDeveloper.totalCommits()).isEqualTo(2);
        var selectedBranch = service.commitAnalytics(91L, "day", null, null, null,
                null, null, "main", null, null, false, false);
        assertThat(selectedBranch.totalCommits()).isEqualTo(2);
        var secondDeveloperAnalytics = service.commitAnalytics(91L, "day", null, null,
                secondUser.getId(), null, null, null, null, null, false, false);
        assertThat(secondDeveloperAnalytics.totalCommits()).isEqualTo(1);
        var branchDrilldown = service.commits(91L, null, "newest", 0, 20,
                null, null, null, null, "main", null, false, false, null, null);
        assertThat(branchDrilldown.getTotalElements()).isEqualTo(2);

        var allCommitTypes = service.commitAnalytics(91L, "day", null, null, null, null,
                null, null, null, null, true, true);
        assertThat(allCommitTypes.totalCommits()).isEqualTo(5);
        assertThat(service.commitAnalytics(91L, "day", null, null, null, null,
                null, null, null, null, true, false).totalCommits()).isEqualTo(4);
        assertThat(service.commitAnalytics(91L, "day", null, null, null, null,
                null, null, null, null, false, true).totalCommits()).isEqualTo(4);
        assertThat(allCommitTypes.developers()).anySatisfy(row -> {
            assertThat(row.bot()).isTrue();
            assertThat(row.name()).isEqualTo("Fixture Bot");
        });
    }

    @Test
    void commitAnalyticsUsesVietnamDayBoundariesAndSupportsDayWeekAndMonthBuckets() {
        GitCommit midnightHcm = commit("e".repeat(40), "feat: midnight HCM",
                Instant.parse("2026-11-15T17:00:00Z"));

        var day = service.commitAnalytics(91L, "day", null, null, null, null,
                null, null, LocalDate.of(2026, 11, 16), LocalDate.of(2026, 11, 16), false, false);
        assertThat(day.totalCommits()).isEqualTo(1);
        assertThat(day.trend()).singleElement().satisfies(point -> {
            assertThat(point.startDate()).isEqualTo(LocalDate.of(2026, 11, 16));
            assertThat(point.endDate()).isEqualTo(LocalDate.of(2026, 11, 16));
        });

        var week = service.commitAnalytics(91L, "week", null, null, null, null,
                null, null, LocalDate.of(2026, 11, 9), LocalDate.of(2026, 11, 15), false, false);
        assertThat(week.totalCommits()).isEqualTo(2);
        assertThat(week.trend()).singleElement().satisfies(point -> {
            assertThat(point.startDate()).isEqualTo(LocalDate.of(2026, 11, 9));
            assertThat(point.endDate()).isEqualTo(LocalDate.of(2026, 11, 15));
            assertThat(point.label()).isEqualTo("W46 2026");
        });

        var month = service.commitAnalytics(91L, "month", null, null, null, null,
                null, null, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30), false, false);
        assertThat(month.totalCommits()).isEqualTo(3);
        assertThat(month.trend()).singleElement().satisfies(point -> {
            assertThat(point.label()).isEqualTo("Nov 2026");
            assertThat(point.startDate()).isEqualTo(LocalDate.of(2026, 11, 1));
            assertThat(point.endDate()).isEqualTo(LocalDate.of(2026, 11, 30));
        });
        assertThat(midnightHcm.getCommittedAt()).isEqualTo(Instant.parse("2026-11-15T17:00:00Z"));
    }

    @Test
    void commitAnalyticsIdentifiesUnmappedContributorsAndValidatesRangeAndGranularity() {
        GitContributor unmapped = contributor("unmapped-author", "Unmapped Author", false, null);
        GitCommit unknown = commit("f".repeat(40), "feat: unmapped activity",
                Instant.parse("2026-11-15T12:00:00Z"));
        unknown.setAuthorContributor(unmapped);
        commits.saveAndFlush(unknown);

        var analytics = service.commitAnalytics(91L, "day", null, null, null,
                null, null, null, null, null, false, false);
        assertThat(analytics.totalCommits()).isEqualTo(3);
        assertThat(analytics.unmappedContributorCommits()).isEqualTo(1);
        assertThat(analytics.developers()).anySatisfy(row -> {
            assertThat(row.name()).isEqualTo("Unmapped Contributor");
            assertThat(row.login()).isEqualTo("unmapped-author");
            assertThat(row.unmapped()).isTrue();
        });
        var unmappedOnly = service.commitAnalytics(91L, "day", null, null, null,
                null, true, null, null, null, false, false);
        assertThat(unmappedOnly.totalCommits()).isEqualTo(1);
        links.deleteAll();
        commits.deleteAll();
        var empty = service.commitAnalytics(91L, "day", null, null, null,
                null, null, null, null, null, false, false);
        assertThat(empty.totalCommits()).isZero();
        assertThat(empty.trend()).isEmpty();
        assertThat(empty.developers()).isEmpty();
        assertThat(empty.branches()).isEmpty();
        assertThatThrownBy(() -> service.commitAnalytics(91L, "quarter", null, null, null,
                null, null, null, null, null, false, false))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.commitAnalytics(91L, "day", null, null, null,
                null, null, null, LocalDate.of(2026, 11, 16), LocalDate.of(2026, 11, 15), false, false))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void commitReadsRetainPreviouslyLinkedRealHistoryAndHideMockRowsAfterRealIntegration() {
        GitRepository realRepository = new GitRepository();
        realRepository.setRootProject(root);
        realRepository.setExternalId(600_000L + root.getId());
        realRepository.setOwner("fixture");
        realRepository.setName("real-history");
        realRepository.setFullName("fixture/real-history");
        realRepository.setHtmlUrl("https://github.com/fixture/real-history");
        realRepository.setDefaultBranch("main");
        realRepository.setStatus(GitRepositoryStatus.INACTIVE);
        realRepository.setSyncStatus(GitSyncStatus.READY);
        realRepository.setMockData(false);
        realRepository = repositories.saveAndFlush(realRepository);

        GitCommit realCommit = new GitCommit();
        realCommit.setRepository(realRepository);
        realCommit.setSha("9".repeat(40));
        realCommit.setMessage("feat: retained real history");
        realCommit.setAuthorContributor(mappedAuthor);
        realCommit.setCommittedAt(Instant.parse("2026-11-15T11:00:00Z"));
        realCommit.setFirstSeenBranch("main");
        realCommit = commits.saveAndFlush(realCommit);

        var analytics = service.commitAnalytics(91L, "day", null, null, null, null,
                null, null, null, null, false, false);
        var history = service.commits(91L, null, "newest", 0, 20, null, null,
                null, null, null, null, null, null, null, null);
        assertThat(analytics.totalCommits()).isEqualTo(1);
        assertThat(history.getTotalElements()).isEqualTo(1);
        assertThat(history.getContent()).extracting(GitActivityDtos.CommitItem::id).containsExactly(realCommit.getId());
        assertThat(service.commit(91L, realCommit.getId()).sha()).isEqualTo(realCommit.getSha());
        assertThat(service.status(91L)).satisfies(status -> {
            assertThat(status.connected()).isFalse();
            assertThat(status.status()).isEqualTo(GitRepositoryStatus.INACTIVE);
            assertThat(status.repositoryName()).isEqualTo("fixture/real-history");
            assertThat(status.mockData()).isFalse();
        });
    }

    @Test
    void disconnectedRepositoryStillReturnsItsRetainedMetadata() {
        repository.setStatus(GitRepositoryStatus.DISCONNECTED);
        repository.setSyncStatus(GitSyncStatus.ERROR);
        repositories.saveAndFlush(repository);

        var status = service.status(91L);

        assertThat(status.connected()).isTrue();
        assertThat(status.status()).isEqualTo(GitRepositoryStatus.DISCONNECTED);
        assertThat(status.syncStatus()).isEqualTo(GitSyncStatus.ERROR);
        assertThat(status.repositoryName()).isEqualTo(repository.getFullName());
        assertThat(status.repositoryUrl()).isEqualTo(repository.getHtmlUrl());
    }

    @Test
    void taskGitLinkCheckConstraintRequiresExactlyOneGitSource() {
        TaskGitLink invalid = new TaskGitLink();
        invalid.setTask(task);
        invalid.setLinkedAt(Instant.now());
        invalid.setSource(TaskGitLinkSource.AUTO);
        assertThatThrownBy(() -> links.saveAndFlush(invalid)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deletingTaskCascadesOnlyItsGitLinkAndPreservesCommitAndOtherTaskLink() {
        SprintBacklog otherTask = new SprintBacklog();
        otherTask.setProjectId(module.getId());
        otherTask.setTitle("Other linked fixture task");
        otherTask = tasks.saveAndFlush(otherTask);
        TaskGitLink secondLink = new TaskGitLink();
        secondLink.setTask(otherTask);
        secondLink.setCommit(linkedCommit);
        secondLink.setSource(TaskGitLinkSource.AUTO);
        secondLink.setLinkedAt(linkedCommit.getCommittedAt());
        links.saveAndFlush(secondLink);
        Long otherTaskId = otherTask.getId();
        Long commitId = linkedCommit.getId();
        Long deletedTaskId = task.getId();

        tasks.delete(task);
        tasks.flush();
        entityManager.clear();

        assertThat(tasks.findById(deletedTaskId)).isEmpty();
        assertThat(commits.existsById(commitId)).isTrue();
        assertThat(links.findAllByCommit_IdOrderByTask_IdAsc(commitId))
                .extracting(link -> link.getTask().getId()).containsExactly(otherTaskId);
    }

    @Test
    void deletingRootProjectCascadesOnlyGitOwnedRows() {
        Long rootId = root.getId();
        Long commitId = linkedCommit.getId();
        tasks.deleteAll();
        tasks.flush();
        projects.delete(module);
        projects.flush();

        projects.delete(root);
        projects.flush();
        entityManager.clear();

        assertThat(projects.findById(rootId)).isEmpty();
        assertThat(repositories.findAllByRootProject_IdOrderByIdAsc(rootId)).isEmpty();
        assertThat(commits.findById(commitId)).isEmpty();
    }

    private GitCommit commit(String sha, String message, Instant at) {
        GitCommit commit = new GitCommit();
        commit.setRepository(repository);
        commit.setSha(sha);
        commit.setMessage(message);
        commit.setAuthorContributor(mappedAuthor);
        commit.setCommittedAt(at);
        commit.setHtmlUrl(repository.getHtmlUrl() + "/commit/" + sha);
        commit.setFirstSeenBranch("main");
        return commits.saveAndFlush(commit);
    }

    private GitContributor contributor(String login, String name, boolean bot, User user) {
        GitContributor contributor = new GitContributor();
        contributor.setRootProject(root);
        contributor.setExternalId(900_000L + contributors.count() + root.getId());
        contributor.setLogin(login);
        contributor.setDisplayName(name);
        contributor.setBot(bot);
        contributor.setUser(user);
        return contributors.saveAndFlush(contributor);
    }
}
