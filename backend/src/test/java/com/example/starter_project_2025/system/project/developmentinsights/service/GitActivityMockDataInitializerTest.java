package com.example.starter_project_2025.system.project.developmentinsights.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitSyncStatus;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitContributorRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitActivityDemoSprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@DataJpaTest
@Import({GitActivityMockDataInitializer.class, GitActivitySprintDemoData.class, GitActivityDemoExpansion.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "app.git-activity.demo.enabled=true")
class GitActivityMockDataInitializerTest {
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired ProjectRepository projects;
    @Autowired SprintBacklogRepository tasks;
    @Autowired GitRepositoryRepository repositories;
    @Autowired GitContributorRepository contributors;
    @Autowired GitCommitRepository commits;
    @Autowired GitPullRequestRepository pullRequests;
    @Autowired GitPullRequestReviewRepository reviews;
    @Autowired TaskGitLinkRepository links;
    @Autowired GitActivityMockDataInitializer initializer;
    @Autowired GitActivityDemoExpansion expansion;
    @Autowired SprintRepository sprints;
    @Autowired GitActivityDemoSprintRepository fixtures;

    @Test
    void addsPullRequestFixturesToAnExistingCommitFixtureAndRemainsIdempotent() {
        Tenant tenant = tenants.saveAndFlush(Tenant.builder()
                .code("GIT-MOCK-UPGRADE-" + UUID.randomUUID())
                .name("Git mock upgrade fixture")
                .build());
        Project root = new Project();
        root.setCode("GIT-MOCK-ROOT-" + UUID.randomUUID());
        root.setName("Git Mock Upgrade Root");
        root.setTenant(tenant);
        root.setStatus(ProjectStatus.ACTIVE);
        root = projects.saveAndFlush(root);

        SprintBacklog task = new SprintBacklog();
        task.setProjectId(root.getId());
        task.setTitle("Existing commit fixture task");
        task.setIsActive(true);
        task = tasks.saveAndFlush(task);

        GitRepository repository = new GitRepository();
        repository.setRootProject(root);
        repository.setExternalId(900_000_000_000_000L + root.getId());
        repository.setOwner("hcm26-sample");
        repository.setName("project-" + root.getId());
        repository.setFullName(repository.getOwner() + "/" + repository.getName());
        repository.setDefaultBranch("main");
        repository.setStatus(GitRepositoryStatus.ACTIVE);
        repository.setSyncStatus(GitSyncStatus.READY);
        repository.setMockData(true);
        repository = repositories.saveAndFlush(repository);

        GitContributor author = new GitContributor();
        author.setRootProject(root);
        author.setExternalId(71_000L + root.getId());
        author.setLogin("dev-b");
        author.setDisplayName("Dev B");
        User mappedUser = new User();
        mappedUser.setEmail("git-mapped-" + UUID.randomUUID() + "@example.test");
        mappedUser.setPasswordHash("fixture-password-hash");
        mappedUser.setFirstName("Mapped member");
        mappedUser = users.saveAndFlush(mappedUser);
        author.setUser(mappedUser);
        author = contributors.saveAndFlush(author);
        GitCommit existingCommit = new GitCommit();
        existingCommit.setRepository(repository);
        existingCommit.setSha("a".repeat(40));
        existingCommit.setMessage("Existing AN-02 fixture commit");
        existingCommit.setAuthorContributor(author);
        existingCommit.setCommittedAt(Instant.parse("2026-11-10T10:00:00Z"));
        existingCommit.setFirstSeenBranch("main");
        existingCommit.setBot(false);
        existingCommit.setMergeCommit(false);
        commits.saveAndFlush(existingCommit);

        Workspace workspace = new Workspace();
        workspace.setProject(root);
        initializer.seedForWorkspace(workspace, root);
        Long seededReviewId = reviews.findAll().get(0).getId();
        initializer.seedForWorkspace(workspace, root);

        assertThat(commits.countByRepository_Id(repository.getId())).isEqualTo(1);
        assertThat(pullRequests.countByRepository_Id(repository.getId())).isEqualTo(2);
        assertThat(reviews.findAll()).hasSize(1);
        assertThat(reviews.findAll()).extracting(GitPullRequestReview::getId).containsExactly(seededReviewId);
        assertThat(contributors.findFirstByRootProject_IdAndExternalId(root.getId(), 71_000L + root.getId())
                .orElseThrow().getUser().getId()).isEqualTo(mappedUser.getId());
        Long expectedTaskId = task.getId();
        assertThat(links.findAllByPullRequest_IdOrderByTask_IdAsc(
                pullRequests.findFirstByRepository_IdAndExternalId(repository.getId(), 91_000L + root.getId())
                        .orElseThrow().getId()))
                .hasSize(2)
                .anySatisfy(link -> assertThat(link.getTask().getId()).isEqualTo(expectedTaskId));
        assertThat(task.getSprint()).isNull();
        assertThat(task.getTitle()).isEqualTo("Existing commit fixture task");
    }

    @Test
    void newlyCreatedMockRepositoryStartsReadyWithSyncMetadata() {
        Tenant tenant = tenants.saveAndFlush(Tenant.builder()
                .code("GIT-MOCK-NEW-" + UUID.randomUUID())
                .name("Git mock new repository fixture")
                .build());
        Project root = new Project();
        root.setCode("GIT-MOCK-NEW-ROOT-" + UUID.randomUUID());
        root.setName("Git Mock New Root");
        root.setTenant(tenant);
        root.setStatus(ProjectStatus.ACTIVE);
        root = projects.saveAndFlush(root);
        Workspace workspace = new Workspace();
        workspace.setProject(root);

        initializer.seedForWorkspace(workspace, root);

        GitRepository repository = repositories.findAllByRootProject_IdOrderByIdAsc(root.getId())
                .stream().filter(GitRepository::isMockData).findFirst().orElseThrow();
        assertThat(repository.getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
        assertThat(repository.getSyncStatus()).isEqualTo(GitSyncStatus.READY);
        assertThat(repository.getLinkedAt()).isNotNull();
        assertThat(repository.getLastSyncedAt()).isNotNull();

        var fixture = fixtures.findById(root.getId()).orElseThrow();
        var reportSprint = fixture.getReportSprint();
        var sampleTasks = tasks.findBySprintIdOrderByIdAsc(reportSprint.getId());
        assertThat(sampleTasks).hasSize(4);
        assertThat(sampleTasks).extracting(SprintBacklog::getStatus)
                .containsExactlyInAnyOrder(SprintBacklogStatus.DONE, SprintBacklogStatus.IN_PROGRESS,
                        SprintBacklogStatus.REVIEW, SprintBacklogStatus.TODO);
        assertThat(links.findAllByTask_IdInOrderByTask_IdAsc(sampleTasks.stream().map(SprintBacklog::getId).toList()))
                .hasSize(5);
        var emptySprint = fixture.getEmptySprint();
        assertThat(emptySprint.getStartDate()).isAfter(reportSprint.getEndDate());
        assertThat(tasks.findBySprintIdOrderByIdAsc(emptySprint.getId())).isEmpty();

        sampleTasks.get(0).setTitle("User-edited sample task");
        tasks.saveAndFlush(sampleTasks.get(0));
        reportSprint.setName("User-renamed report Sprint");
        reportSprint.setSprintGoal("User-edited Sprint goal");
        emptySprint.setName("User-renamed empty Sprint");
        sprints.saveAndFlush(reportSprint);
        sprints.saveAndFlush(emptySprint);
        initializer.seedForWorkspace(workspace, root);
        assertThat(tasks.findBySprintIdOrderByIdAsc(reportSprint.getId())).hasSize(4)
                .anySatisfy(row -> assertThat(row.getTitle()).isEqualTo("User-edited sample task"));
        assertThat(sprints.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(root.getId())).hasSize(2);
        assertThat(commits.countByRepository_Id(repository.getId())).isEqualTo(6);
        assertThat(pullRequests.countByRepository_Id(repository.getId())).isEqualTo(2);
        assertThat(fixtures.findById(root.getId()).orElseThrow().getReportSprint().getId()).isEqualTo(reportSprint.getId());
        assertThat(reportSprint.getName()).isEqualTo("User-renamed report Sprint");
        assertThat(reportSprint.getSprintGoal()).isEqualTo("User-edited Sprint goal");
    }

    @Test
    void sameTeamCanReceiveAnotherProjectWithoutConflictingDemoNamesOrAnotherActiveSprint() {
        ProjectTeam team = new ProjectTeam();
        team.setId(99_001L);
        Project first = projectFixture("First team assignment");
        Project second = projectFixture("Second team assignment");
        Workspace workspace = new Workspace();
        workspace.setTeam(team);
        workspace.setProject(first);
        initializer.seedForWorkspace(workspace, first);
        workspace.setProject(second);
        initializer.seedForWorkspace(workspace, second);

        var firstSprint = fixtures.findById(first.getId()).orElseThrow().getReportSprint();
        var secondSprint = fixtures.findById(second.getId()).orElseThrow().getReportSprint();
        assertThat(firstSprint.getName()).isNotEqualTo(secondSprint.getName());
        assertThat(firstSprint.getStatus()).isEqualTo(SprintStatus.ACTIVE);
        assertThat(secondSprint.getStatus()).isEqualTo(SprintStatus.PLANNED);
        assertThat(firstSprint.getTeamId()).isEqualTo(team.getId());
        assertThat(secondSprint.getTeamId()).isEqualTo(team.getId());
    }

    @Test
    void seedPreservesAnExistingActiveSprintAndDoesNotResurrectDeletedFixtures() {
        Project root = projectFixture("Existing active Sprint fixture");
        Sprint active = new Sprint();
        active.setProjectId(root.getId());
        active.setName("Existing user Sprint");
        active.setStatus(SprintStatus.ACTIVE);
        sprints.saveAndFlush(active);
        Workspace workspace = new Workspace();
        workspace.setProject(root);
        initializer.seedForWorkspace(workspace, root);
        var fixture = fixtures.findById(root.getId()).orElseThrow();
        assertThat(fixture.getReportSprint().getStatus()).isEqualTo(SprintStatus.PLANNED);
        assertThat(active.getStatus()).isEqualTo(SprintStatus.ACTIVE);
        Long deletedId = fixture.getEmptySprint().getId();
        sprints.delete(fixture.getEmptySprint());
        sprints.flush();
        initializer.seedForWorkspace(workspace, root);
        assertThat(sprints.findById(deletedId)).isEmpty();
        assertThat(sprints.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(root.getId())).hasSize(2);
    }

    @Test
    void expandedSeedCoversEveryModuleAndPreservesEditsAndManualLinksOnRestart() {
        Project root = projectFixture("Expanded demo Master");
        Project auth = new Project();
        auth.setCode("EXPANDED-AUTH");
        auth.setName("Module Auth");
        auth.setTenant(root.getTenant());
        auth.setParentProject(root);
        auth.setStatus(ProjectStatus.ACTIVE);
        auth = projects.saveAndFlush(auth);
        Project catalog = new Project();
        catalog.setCode("EXPANDED-CATALOG");
        catalog.setName("Module Catalog");
        catalog.setTenant(root.getTenant());
        catalog.setParentProject(root);
        catalog.setStatus(ProjectStatus.ACTIVE);
        catalog = projects.saveAndFlush(catalog);
        Workspace workspace = new Workspace();
        workspace.setProject(root);
        initializer.seedForWorkspace(workspace, root);
        var projectIds = java.util.List.of(root.getId(), auth.getId(), catalog.getId());

        expansion.seed(root, projectIds);

        GitRepository repository = repositories.findAllByRootProject_IdOrderByIdAsc(root.getId()).get(0);
        assertThat(commits.countByRepository_Id(repository.getId())).isEqualTo(6 + 36 * 3);
        assertThat(pullRequests.countByRepository_Id(repository.getId())).isEqualTo(2 + 12 * 3);
        assertThat(reviews.findAll()).hasSize(1 + 24 * 3);
        for (Long moduleId : java.util.List.of(auth.getId(), catalog.getId())) {
            assertThat(links.findAll().stream().filter(link -> moduleId.equals(link.getTask().getProjectId()))
                    .filter(link -> link.getCommit() != null)).hasSize(33);
            assertThat(links.findAll().stream().filter(link -> moduleId.equals(link.getTask().getProjectId()))
                    .filter(link -> link.getPullRequest() != null)).hasSize(12);
        }
        assertThat(pullRequests.findAll()).extracting(pr -> pr.getState().name())
                .contains("OPEN", "MERGED", "CLOSED");
        assertThat(reviews.findAll()).extracting(review -> review.getState().name())
                .contains("APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED");
        assertThat(commits.findAll()).allSatisfy(commit -> assertThat(commit.getCommittedAt()).isBeforeOrEqualTo(Instant.now()));

        var editedLink = links.findAll().stream().filter(link -> link.getCommit() != null
                && link.getCommit().getSha().startsWith("de00cafe")).findFirst().orElseThrow();
        editedLink.getCommit().setMessage("User edited demo commit");
        editedLink.setSource(com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource.MANUAL);
        links.saveAndFlush(editedLink);
        long taskCount = tasks.count();
        long linkCount = links.count();
        expansion.seed(root, projectIds);

        assertThat(commits.countByRepository_Id(repository.getId())).isEqualTo(114);
        assertThat(pullRequests.countByRepository_Id(repository.getId())).isEqualTo(38);
        assertThat(reviews.findAll()).hasSize(73);
        assertThat(tasks.count()).isEqualTo(taskCount);
        assertThat(links.count()).isEqualTo(linkCount);
        assertThat(commits.findById(editedLink.getCommit().getId()).orElseThrow().getMessage()).isEqualTo("User edited demo commit");
        assertThat(links.findById(editedLink.getId()).orElseThrow().getSource().name()).isEqualTo("MANUAL");
    }

    private Project projectFixture(String name) {
        Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("GIT-DEMO-" + UUID.randomUUID()).name(name).build());
        Project project = new Project();
        project.setCode("GIT-DEMO-" + UUID.randomUUID());
        project.setName(name);
        project.setTenant(tenant);
        project.setStatus(ProjectStatus.ACTIVE);
        return projects.saveAndFlush(project);
    }

    @Test
    void previouslyLinkedRealRepositoryPreventsMockFixtureFromBeingRecreated() {
        Tenant tenant = tenants.saveAndFlush(Tenant.builder()
                .code("GIT-MOCK-REAL-HISTORY-" + UUID.randomUUID())
                .name("Real repository history")
                .build());
        Project root = new Project();
        root.setCode("GIT-MOCK-REAL-ROOT-" + UUID.randomUUID());
        root.setName("Real Repository Root");
        root.setTenant(tenant);
        root.setStatus(ProjectStatus.ACTIVE);
        root = projects.saveAndFlush(root);
        GitRepository realRepository = new GitRepository();
        realRepository.setRootProject(root);
        realRepository.setExternalId(990_000L + root.getId());
        realRepository.setOwner("real-owner");
        realRepository.setName("real-project");
        realRepository.setFullName("real-owner/real-project");
        realRepository.setStatus(GitRepositoryStatus.INACTIVE);
        realRepository.setSyncStatus(GitSyncStatus.READY);
        realRepository.setMockData(false);
        repositories.saveAndFlush(realRepository);

        initializer.seedForWorkspace(new Workspace(), root);
        expansion.seed(root, java.util.List.of(root.getId()));

        assertThat(repositories.findAllByRootProject_IdOrderByIdAsc(root.getId()))
                .singleElement().satisfies(repository -> {
                    assertThat(repository.isMockData()).isFalse();
                    assertThat(repository.getStatus()).isEqualTo(GitRepositoryStatus.INACTIVE);
                });
        assertThat(commits.countByRepository_Id(realRepository.getId())).isZero();
        assertThat(tasks.findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(java.util.List.of(root.getId()))).isEmpty();
    }
}
