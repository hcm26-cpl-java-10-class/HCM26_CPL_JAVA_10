package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceReason;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.git_integration.webhook.GitHubWebhookSignatureVerifier;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventProcessor;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.key.BacklogTaskKeyService;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-SY-05 acceptance criteria: commits and pull requests linked to tasks through Task IDs. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GitTaskLinkIntegrationTest {

    private static final String SECRET = "test-webhook-secret";
    private static final long GITHUB_INSTALLATION_ID = 556677L;
    private static final long REPO = 9301L;

    @DynamicPropertySource
    static void githubApp(DynamicPropertyRegistry registry) throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        String pem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(generator.generateKeyPair().getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----";
        registry.add("app.github.enabled", () -> "true");
        registry.add("app.github.app-id", () -> "123");
        registry.add("app.github.app-slug", () -> "test-app");
        registry.add("app.github.client-id", () -> "Iv1.test");
        registry.add("app.github.client-secret", () -> "test-secret");
        registry.add("app.github.private-key-path", () -> "");
        registry.add("app.github.private-key", () -> pem);
        registry.add("app.github.callback-url", () -> "http://localhost:5173/git-integration/github/callback");
        registry.add("app.github.webhook-secret", () -> SECRET);
        registry.add("app.github.webhook-dispatch-enabled", () -> "false");
        registry.add("app.github.webhook-poller-enabled", () -> "false");
        registry.add("app.github.sync-dispatch-enabled", () -> "false");
        registry.add("app.github.sync-poller-enabled", () -> "false");
        registry.add("app.github.task-link-sweep-enabled", () -> "false");
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @Autowired TenantRepository tenants;
    @Autowired ProjectRepository projects;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired GitInstallationRepository installations;
    @Autowired GitRepositoryRepository connections;
    @Autowired GitSyncJobRepository jobs;
    @Autowired GitWebhookEventRepository events;
    @Autowired GitCommitRepository commits;
    @Autowired GitPullRequestRepository pullRequests;
    @Autowired GitPullRequestReviewRepository reviews;
    @Autowired BacklogReferenceRepository references;
    @Autowired BacklogGitLinkRepository links;
    @Autowired SprintBacklogRepository backlogs;
    @Autowired BacklogTaskKeyService taskKeys;
    @Autowired GitWebhookEventProcessor processor;
    @Autowired GitHubWebhookSignatureVerifier verifier;
    @Autowired GitTaskLinker linker;
    @Autowired GitTaskLinkSweeper sweeper;

    @MockBean GitHubApiClient github;

    Long tenantId;
    Long masterId;
    Long moduleId;
    Long otherProjectId;
    Long connectionId;
    /** Tasks: of the master, of a module, of another project of the tenant, deleted, of another tenant. */
    SprintBacklog masterTask;
    SprintBacklog moduleTask;
    SprintBacklog otherProjectTask;
    SprintBacklog deletedTask;
    String otherTenantOnlyKey;
    String readerToken;
    String managerToken;
    String otherTenantToken;
    String noBacklogPermissionToken;

    @BeforeEach
    void fixture() {
        links.deleteAll();
        references.deleteAll();
        reviews.deleteAll();
        pullRequests.deleteAll();
        commits.deleteAll();
        events.deleteAll();
        jobs.deleteAll();
        connections.deleteAll();
        installations.deleteAll();
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("SY5-" + UUID.randomUUID()).name("SY-05").build());
            Tenant other = tenants.saveAndFlush(Tenant.builder().code("SY5-O-" + UUID.randomUUID()).name("Other").build());
            tenantId = tenant.getId();
            Project master = project(tenant, "Web Shop", null);
            masterId = master.getId();
            moduleId = project(tenant, "Cart module", master).getId();
            otherProjectId = project(tenant, "Banking", null).getId();
            Long otherTenantProject = project(other, "Other tenant", null).getId();

            masterTask = task("Shop landing page", masterId, SprintBacklogStatus.TODO);
            moduleTask = task("Add cart page", moduleId, SprintBacklogStatus.IN_PROGRESS);
            otherProjectTask = task("Banking login", otherProjectId, SprintBacklogStatus.TODO);
            deletedTask = task("Dropped idea", moduleId, SprintBacklogStatus.TODO);
            deletedTask.setIsActive(false);
            backlogs.saveAndFlush(deletedTask);
            // The other tenant numbers its own FA-* keys; one of them does not exist in this tenant.
            SprintBacklog foreign = null;
            for (int i = 0; i < 6; i++) foreign = task("Foreign " + i, otherTenantProject, SprintBacklogStatus.TODO);
            otherTenantOnlyKey = foreign.getTaskKey();

            Long installationRow = installations.saveAndFlush(GitInstallation.builder()
                    .tenantId(tenantId).provider(GitProvider.GITHUB).installationId(GITHUB_INSTALLATION_ID)
                    .accountId(1L).accountLogin("hcm26-java-team").accountType("Organization").repositorySelection("selected")
                    .status(GitInstallationStatus.CONNECTED).connectedByUserId(1L)
                    .connectedAt(LocalDateTime.now()).lastVerifiedAt(LocalDateTime.now()).build()).getId();
            connectionId = connections.saveAndFlush(GitRepository.builder()
                    .tenantId(tenantId).projectId(masterId).installationRef(installationRow)
                    .provider(GitProvider.GITHUB).externalId(REPO).ownerLogin("hcm26-java-team").name("webshop")
                    .fullName("hcm26-java-team/webshop").htmlUrl("https://github.com/hcm26-java-team/webshop")
                    .visibility("private").defaultBranch("main").status(GitRepositoryStatus.ACTIVE)
                    .linkedByUserId(1L).linkedAt(LocalDateTime.now()).build()).getId();

            readerToken = token(user(tenant, role("SY5-READ-", "GIT_INTEGRATION_READ", "SPRINT_BACKLOG_READ")));
            managerToken = token(user(tenant, role("SY5-MANAGE-", "GIT_INTEGRATION_MANAGE", "SPRINT_BACKLOG_READ")));
            otherTenantToken = token(user(other, role("SY5-OTHER-", "GIT_INTEGRATION_READ", "SPRINT_BACKLOG_READ")));
            noBacklogPermissionToken = token(user(tenant, role("SY5-NONE-", "GIT_INTEGRATION_READ")));
        });
        assertThat(otherTenantOnlyKey).isNotIn(masterTask.getTaskKey(), moduleTask.getTaskKey(),
                otherProjectTask.getTaskKey(), deletedTask.getTaskKey());
    }

    // ---- AC01 / AC02: valid Task IDs are linked and shown in Task Detail ---------------------------

    @Test
    void ac01CommitWithAValidTaskIdIsLinkedAndShownInTaskDetail() throws Exception {
        push(commit("a1", moduleTask.getTaskKey() + ": add cart page", "2026-11-17T10:00:00Z"));

        GitCommit stored = commit("a1");
        assertThat(references(stored)).singleElement().satisfies(ref -> {
            assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.LINKED);
            assertThat(ref.getBacklogItemId()).isEqualTo(moduleTask.getId());
            assertThat(ref.getSourceField()).isEqualTo(BacklogReferenceField.MESSAGE);
        });
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links", moduleTask.getId())
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taskKey").value(moduleTask.getTaskKey()))
                .andExpect(jsonPath("$.commitCount").value(1))
                .andExpect(jsonPath("$.commits.items[0].sha").value("a1"))
                .andExpect(jsonPath("$.repository.fullName").value("hcm26-java-team/webshop"));
    }

    @Test
    void ac01TasksOfTheMasterProjectItselfAreLinkedToo() throws Exception {
        push(commit("m1", "chore " + masterTask.getTaskKey().toLowerCase() + " landing copy", "2026-11-17T10:00:00Z"));

        assertThat(links.countByBacklogItemIdAndArtifactType(masterTask.getId(), GitArtifactType.COMMIT)).isEqualTo(1);
    }

    @Test
    void ac02EveryNewCommitWithTheSameTaskIdIsAddedNewestFirst() throws Exception {
        push(commit("b1", moduleTask.getTaskKey() + ": cart model", "2026-11-17T09:00:00Z"));
        push(commit("b2", "[" + moduleTask.getTaskKey() + "] cart view", "2026-11-17T11:00:00Z"));

        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links", moduleTask.getId())
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commitCount").value(2))
                .andExpect(jsonPath("$.commits.items[0].sha").value("b2"))
                .andExpect(jsonPath("$.commits.items[1].sha").value("b1"));
    }

    @Test
    void aCommitCanLinkSeveralTasksAndATaskSeveralCommits() throws Exception {
        push(commit("n1", moduleTask.getTaskKey() + " " + masterTask.getTaskKey() + ": shared header", "2026-11-17T10:00:00Z"),
                commit("n2", "fixes " + moduleTask.getTaskKey(), "2026-11-17T10:05:00Z"));

        assertThat(links.countByBacklogItemIdAndArtifactType(moduleTask.getId(), GitArtifactType.COMMIT)).isEqualTo(2);
        assertThat(links.countByBacklogItemIdAndArtifactType(masterTask.getId(), GitArtifactType.COMMIT)).isEqualTo(1);
    }

    // ---- AC03 / AC04 / missing: no link, the reason is kept ------------------------------------------

    @Test
    void ac03UnknownOrDeletedTaskIdsAreNotLinkedAndTheReasonIsKept() throws Exception {
        push(commit("i1", "FA-999999 typo in key", "2026-11-17T10:00:00Z"),
                commit("i2", deletedTask.getTaskKey() + ": revive", "2026-11-17T10:01:00Z"),
                commit("i3", otherTenantOnlyKey + ": not ours", "2026-11-17T10:02:00Z"));

        assertThat(references(commit("i1"))).singleElement().satisfies(ref -> {
            assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.INVALID);
            assertThat(ref.getReason()).isEqualTo(BacklogReferenceReason.NOT_FOUND);
            assertThat(ref.getBacklogItemId()).isNull();
        });
        assertThat(references(commit("i2"))).singleElement()
                .satisfies(ref -> assertThat(ref.getReason()).isEqualTo(BacklogReferenceReason.DELETED));
        assertThat(references(commit("i3"))).singleElement()
                .satisfies(ref -> assertThat(ref.getReason()).isEqualTo(BacklogReferenceReason.NOT_FOUND));
        assertThat(links.count()).isZero();
    }

    @Test
    void ac04ATaskOfAnotherProjectIsNotLinkedAndIsMarkedOutsideProject() throws Exception {
        push(commit("o1", otherProjectTask.getTaskKey() + ": wrong repo", "2026-11-17T10:00:00Z"));

        assertThat(references(commit("o1"))).singleElement().satisfies(ref -> {
            assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.OUTSIDE_PROJECT);
            assertThat(ref.getReason()).isEqualTo(BacklogReferenceReason.OTHER_PROJECT);
        });
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links", otherProjectTask.getId())
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commitCount").value(0));
    }

    @Test
    void aCommitWithoutAnyTaskIdIsRecordedAsMissing() throws Exception {
        push(commit("x1", "fix typo, bump UTF-8 / SHA-256 handling, see #12", "2026-11-17T10:00:00Z"));

        assertThat(references(commit("x1"))).singleElement().satisfies(ref -> {
            assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.MISSING);
            assertThat(ref.getRefKey()).isEqualTo(BacklogReference.NO_KEY);
        });
    }

    // ---- AC05: linking never moves a task --------------------------------------------------------------

    @Test
    void ac05LinkingCommitsNeverChangesTheTaskStatus() throws Exception {
        Long versionBefore = backlogs.findById(moduleTask.getId()).orElseThrow().getVersion();

        push(commit("s1", moduleTask.getTaskKey() + ": done, closes everything", "2026-11-17T10:00:00Z"),
                commit("s2", "Finish " + moduleTask.getTaskKey(), "2026-11-17T10:10:00Z"));

        SprintBacklog after = backlogs.findById(moduleTask.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(SprintBacklogStatus.IN_PROGRESS);
        assertThat(after.getVersion()).isEqualTo(versionBefore);
        assertThat(links.countByBacklogItemIdAndArtifactType(moduleTask.getId(), GitArtifactType.COMMIT)).isEqualTo(2);
    }

    // ---- pull requests ---------------------------------------------------------------------------------

    @Test
    void pullRequestsAreLinkedFromTitleOrBranchAndFollowTitleEdits() throws Exception {
        deliverAndProcess("pull_request", pullRequest("opened", 7, "Add cart " + moduleTask.getTaskKey(), "feature/cart",
                "2026-11-17T09:00:00Z"));
        Long prId = pullRequests.findByRepositoryIdAndNumber(connectionId, 7).orElseThrow().getId();
        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(), GitArtifactType.PULL_REQUEST, prId))
                .isPresent();

        // The title no longer names the module task; the branch names the master task.
        deliverAndProcess("pull_request", pullRequest("edited", 7, "Add cart",
                "feature/" + masterTask.getTaskKey() + "-cart", "2026-11-17T09:30:00Z"));

        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(), GitArtifactType.PULL_REQUEST, prId))
                .isEmpty();
        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(masterTask.getId(), GitArtifactType.PULL_REQUEST, prId))
                .isPresent();
        assertThat(references.findBySourceTypeAndSourceId(GitArtifactType.PULL_REQUEST, prId)).singleElement()
                .satisfies(ref -> assertThat(ref.getSourceField()).isEqualTo(BacklogReferenceField.BRANCH));
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links", masterTask.getId())
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pullRequestCount").value(1))
                .andExpect(jsonPath("$.pullRequests[0].number").value(7));
    }

    // ---- reliability -------------------------------------------------------------------------------------

    @Test
    void processingTheSameCommitsAgainOrInParallelCreatesNothingTwice() throws Exception {
        push(commit("d1", moduleTask.getTaskKey() + ": once", "2026-11-17T10:00:00Z"));
        Long id = commit("d1").getId();

        List<Runnable> runs = new ArrayList<>();
        for (int i = 0; i < 5; i++) runs.add(() -> linker.linkCommits(List.of(id)));
        runInParallel(runs);

        assertThat(references(commit("d1"))).hasSize(1);
        assertThat(links.countByBacklogItemIdAndArtifactType(moduleTask.getId(), GitArtifactType.COMMIT)).isEqualTo(1);
    }

    @Test
    void theSweeperLinksCommitsStoredBeforeTheFeatureExisted() {
        Long id = tx.execute(status -> commits.saveAndFlush(GitCommit.builder()
                .tenantId(tenantId).projectId(masterId).repositoryId(connectionId).repoExternalId(REPO)
                .sha("old1").message(moduleTask.getTaskKey() + ": from before SY-05")
                .committedAt(LocalDateTime.of(2026, 11, 1, 9, 0)).firstSeenRef("refs/heads/main")
                .source(GitCommitSource.WEBHOOK_PAYLOAD).ingestedEventId(1L).ingestedAt(LocalDateTime.now())
                .build()).getId());
        assertThat(references.findBySourceTypeAndSourceId(GitArtifactType.COMMIT, id)).isEmpty();

        assertThat(sweeper.sweep(connectionId)).isEqualTo(1);

        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(), GitArtifactType.COMMIT, id))
                .isPresent();
        assertThat(sweeper.sweep(connectionId)).isZero();
    }

    @Test
    void recheckLinksATaskThatWasRestoredAndIsManagerOnly() throws Exception {
        push(commit("r1", deletedTask.getTaskKey() + ": revive", "2026-11-17T10:00:00Z"));
        jdbc.update("UPDATE sprint_backlog SET is_active = TRUE WHERE sprint_backlog_id = ?", deletedTask.getId());

        mvc.perform(post("/api/v1/git-integration/projects/{id}/repository/task-links/recheck", masterId)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/git-integration/projects/{id}/repository/task-links/recheck", masterId)
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checked").value(1))
                .andExpect(jsonPath("$.nowLinked").value(1));

        assertThat(references(commit("r1"))).singleElement()
                .satisfies(ref -> assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.LINKED));
        assertThat(links.countByBacklogItemIdAndArtifactType(deletedTask.getId(), GitArtifactType.COMMIT)).isEqualTo(1);
    }

    // ---- read APIs ---------------------------------------------------------------------------------------

    @Test
    void commitListShowsTheTaskRefsAndFiltersByVerdict() throws Exception {
        push(commit("l1", moduleTask.getTaskKey() + ": linked", "2026-11-17T10:00:00Z"),
                commit("l2", "no key here", "2026-11-17T10:01:00Z"),
                commit("l3", otherProjectTask.getTaskKey() + ": wrong project", "2026-11-17T10:02:00Z"));

        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/commits", moduleId)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.items[0].sha").value("l3"))
                .andExpect(jsonPath("$.items[0].taskRefs[0].status").value("OUTSIDE_PROJECT"))
                .andExpect(jsonPath("$.items[0].taskRefs[0].itemTitle").doesNotExist())
                .andExpect(jsonPath("$.items[2].taskRefs[0].key").value(moduleTask.getTaskKey()))
                .andExpect(jsonPath("$.items[2].taskRefs[0].itemTitle").value("Add cart page"));
        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/commits", masterId)
                        .param("link", "NEEDS_ATTENTION").header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/commits", masterId)
                        .param("link", "LINKED").header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].sha").value("l1"));
    }

    @Test
    void statsCountTheVerdictsAndTheInProgressTasksWithoutCommits() throws Exception {
        push(commit("t1", moduleTask.getTaskKey() + ": linked", "2026-11-17T10:00:00Z"),
                commit("t2", "no key", "2026-11-17T10:01:00Z"),
                commit("t3", "FA-999999", "2026-11-17T10:02:00Z"));

        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/task-links/stats", masterId)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commits.total").value(3))
                .andExpect(jsonPath("$.commits.processed").value(3))
                .andExpect(jsonPath("$.commits.linked").value(1))
                .andExpect(jsonPath("$.commits.missing").value(1))
                .andExpect(jsonPath("$.commits.invalid").value(1))
                .andExpect(jsonPath("$.tasksWithCommits").value(1))
                .andExpect(jsonPath("$.inProgressTasksWithoutCommits").value(0));
        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/activity", masterId)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linkedCommitCount").value(1));
    }

    @Test
    void boardSummaryCountsLinksAndLeavesOutTasksTheCallerCannotOpen() throws Exception {
        push(commit("u1", moduleTask.getTaskKey() + ": one", "2026-11-17T10:00:00Z"),
                commit("u2", moduleTask.getTaskKey() + ": two", "2026-11-17T10:01:00Z"));
        deliverAndProcess("pull_request", pullRequest("opened", 9, moduleTask.getTaskKey() + " cart", "feature/cart",
                "2026-11-17T11:00:00Z"));

        String ids = moduleTask.getId() + "," + masterTask.getId();
        mvc.perform(get("/api/v1/git-integration/backlog-items/git-link-summary").param("ids", ids)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].itemId").value(moduleTask.getId()))
                .andExpect(jsonPath("$[0].commitCount").value(2))
                .andExpect(jsonPath("$[0].pullRequestCount").value(1))
                .andExpect(jsonPath("$[0].latestPullRequestNumber").value(9))
                .andExpect(jsonPath("$[0].latestPullRequestState").value("OPEN"))
                .andExpect(jsonPath("$[1].commitCount").value(0));
        mvc.perform(get("/api/v1/git-integration/backlog-items/git-link-summary").param("ids", ids)
                        .header("Authorization", "Bearer " + otherTenantToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void taskDetailFollowsTheTaskVisibility() throws Exception {
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links", moduleTask.getId())
                        .header("Authorization", "Bearer " + otherTenantToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_BACKLOG_ITEM_NOT_FOUND"));
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links", moduleTask.getId())
                        .header("Authorization", "Bearer " + noBacklogPermissionToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links", 987654321L)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isNotFound());
    }

    // ---- helpers -----------------------------------------------------------------------------------------

    private Project project(Tenant tenant, String name, Project parent) {
        Project project = new Project();
        project.setCode("SY5-" + UUID.randomUUID());
        project.setName(name);
        project.setTenant(tenant);
        project.setStatus(ProjectStatus.ACTIVE);
        project.setParentProject(parent);
        return projects.saveAndFlush(project);
    }

    /** A task with a generated Task ID (default prefix FA: no workspace in this fixture). */
    private SprintBacklog task(String title, Long projectId, SprintBacklogStatus status) {
        SprintBacklog task = new SprintBacklog();
        task.setTitle(title);
        task.setProjectId(projectId);
        task.setStatus(status);
        taskKeys.assign(task);
        return backlogs.saveAndFlush(task);
    }

    private Role role(String prefix, String... permissionNames) {
        Role role = new Role();
        role.setName(prefix + UUID.randomUUID());
        role.setIsActive(true);
        Set<Permission> granted = new HashSet<>();
        for (String name : permissionNames) granted.add(permissions.findByName(name).orElseThrow());
        role.setPermissions(granted);
        return roles.saveAndFlush(role);
    }

    private User user(Tenant tenant, Role role) {
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@sy5.test");
        user.setFirstName("Git");
        user.setLastName("Linker");
        user.setUserCode("SY5-" + UUID.randomUUID());
        user.setPasswordHash("unused-test-password");
        user.setTenant(tenant);
        user.setRoles(new HashSet<>(Set.of(role)));
        return users.saveAndFlush(user);
    }

    private String token(User user) {
        var principal = userDetails.loadUserByUsername(user.getEmail());
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private GitCommit commit(String sha) {
        return commits.findAll().stream().filter(c -> c.getSha().equals(sha)).findFirst().orElseThrow();
    }

    private List<BacklogReference> references(GitCommit commit) {
        return references.findBySourceTypeAndSourceId(GitArtifactType.COMMIT, commit.getId());
    }

    private ObjectNode base() {
        ObjectNode root = json.createObjectNode();
        ObjectNode repository = root.putObject("repository");
        repository.put("id", REPO);
        repository.put("name", "webshop");
        repository.put("full_name", "hcm26-java-team/webshop");
        repository.putObject("owner").put("login", "hcm26-java-team");
        root.putObject("installation").put("id", GITHUB_INSTALLATION_ID);
        root.putObject("sender").put("login", "dev-a");
        return root;
    }

    private ObjectNode commit(String sha, String message, String timestamp) {
        ObjectNode commit = json.createObjectNode();
        commit.put("id", sha);
        commit.put("message", message);
        commit.put("timestamp", timestamp);
        commit.put("url", "https://github.com/hcm26-java-team/webshop/commit/" + sha);
        commit.putObject("author").put("name", "Dev A").put("email", "dev-a@example.com").put("username", "dev-a");
        commit.putObject("committer").put("name", "Dev A").put("email", "dev-a@example.com").put("username", "dev-a");
        commit.putArray("added");
        commit.putArray("removed");
        commit.putArray("modified").add("Cart.java");
        return commit;
    }

    /** A push of the given commits on main, delivered through the webhook endpoint and processed. */
    private void push(ObjectNode... pushed) throws Exception {
        ObjectNode root = base();
        root.put("ref", "refs/heads/main");
        root.put("before", "1".repeat(40));
        root.put("after", pushed[pushed.length - 1].get("id").asText());
        root.put("created", false);
        root.put("deleted", false);
        root.put("forced", false);
        ArrayNode list = root.putArray("commits");
        for (ObjectNode commit : pushed) list.add(commit);
        deliverAndProcess("push", root);
    }

    private ObjectNode pullRequest(String action, int number, String title, String branch, String updatedAt) {
        ObjectNode root = base();
        root.put("action", action);
        root.put("number", number);
        ObjectNode pr = root.putObject("pull_request");
        pr.put("id", 80_000L + number);
        pr.put("number", number);
        pr.put("title", title);
        pr.put("body", "Implements the cart");
        pr.put("state", "open");
        pr.put("draft", false);
        pr.put("merged", false);
        pr.put("html_url", "https://github.com/hcm26-java-team/webshop/pull/" + number);
        pr.putObject("user").put("login", "dev-a").put("id", 501L);
        pr.putObject("head").put("ref", branch).put("sha", "h" + number);
        pr.putObject("base").put("ref", "main");
        pr.put("created_at", "2026-11-17T08:00:00Z");
        pr.put("updated_at", updatedAt);
        return root;
    }

    private void deliverAndProcess(String event, ObjectNode body) throws Exception {
        String deliveryId = "delivery-" + UUID.randomUUID();
        byte[] bytes = json.writeValueAsString(body).getBytes(StandardCharsets.UTF_8);
        mvc.perform(post("/api/webhooks/github").contentType(MediaType.APPLICATION_JSON).content(bytes)
                        .header("X-GitHub-Event", event)
                        .header("X-GitHub-Delivery", deliveryId)
                        .header("X-Hub-Signature-256", verifier.sign(SECRET, bytes)))
                .andExpect(status().isAccepted());
        processor.process(events.findByProviderAndDeliveryId(GitProvider.GITHUB, deliveryId).orElseThrow().getId());
    }

    private static void runInParallel(List<Runnable> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<?>> futures = new ArrayList<>();
            for (Runnable task : tasks) {
                futures.add(pool.submit(() -> {
                    start.await();
                    task.run();
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> future : futures) future.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }
    }
}
