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
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkExclusionRepository;
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

/**
 * Fixture shared by the task link tests (SY-05 commits, TM-03 pull requests): a tenant with
 * a master project, a module and another project, their tasks, a linked repository and
 * users; events go through the real webhook endpoint and processor.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class AbstractTaskLinkIntegrationTest {


    protected static final String SECRET = "test-webhook-secret";
    protected static final long GITHUB_INSTALLATION_ID = 556677L;
    protected static final long REPO = 9301L;

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
    @Autowired BacklogGitLinkExclusionRepository exclusions;
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
    /** TM-03: may open and update tasks (manual links), without any Git Integration permission. */
    String developerToken;
    Long developerId;

    @BeforeEach
    void fixture() {
        exclusions.deleteAll();
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
            User developer = user(tenant, role("SY5-DEV-", "SPRINT_BACKLOG_READ", "SPRINT_BACKLOG_UPDATE"));
            developerId = developer.getId();
            developerToken = token(developer);
        });
        assertThat(otherTenantOnlyKey).isNotIn(masterTask.getTaskKey(), moduleTask.getTaskKey(),
                otherProjectTask.getTaskKey(), deletedTask.getTaskKey());
    }

    // ---- helpers -----------------------------------------------------------------------------------------

    protected Project project(Tenant tenant, String name, Project parent) {
        Project project = new Project();
        project.setCode("SY5-" + UUID.randomUUID());
        project.setName(name);
        project.setTenant(tenant);
        project.setStatus(ProjectStatus.ACTIVE);
        project.setParentProject(parent);
        return projects.saveAndFlush(project);
    }

    /** A task with a generated Task ID (default prefix FA: no workspace in this fixture). */
    protected SprintBacklog task(String title, Long projectId, SprintBacklogStatus status) {
        SprintBacklog task = new SprintBacklog();
        task.setTitle(title);
        task.setProjectId(projectId);
        task.setStatus(status);
        taskKeys.assign(task);
        return backlogs.saveAndFlush(task);
    }

    protected Role role(String prefix, String... permissionNames) {
        Role role = new Role();
        role.setName(prefix + UUID.randomUUID());
        role.setIsActive(true);
        Set<Permission> granted = new HashSet<>();
        for (String name : permissionNames) granted.add(permissions.findByName(name).orElseThrow());
        role.setPermissions(granted);
        return roles.saveAndFlush(role);
    }

    protected User user(Tenant tenant, Role role) {
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

    protected String token(User user) {
        var principal = userDetails.loadUserByUsername(user.getEmail());
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    protected GitCommit commit(String sha) {
        return commits.findAll().stream().filter(c -> c.getSha().equals(sha)).findFirst().orElseThrow();
    }

    protected List<BacklogReference> references(GitCommit commit) {
        return references.findBySourceTypeAndSourceId(GitArtifactType.COMMIT, commit.getId());
    }

    protected ObjectNode base() {
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

    protected ObjectNode commit(String sha, String message, String timestamp) {
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
    protected void push(ObjectNode... pushed) throws Exception {
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

    protected ObjectNode pullRequest(String action, int number, String title, String branch, String updatedAt) {
        return pullRequest(action, number, title, "Implements the cart", branch, updatedAt, false);
    }

    /** A pull request event; {@code merged} closes it as merged. */
    protected ObjectNode pullRequest(String action, int number, String title, String description, String branch,
                                     String updatedAt, boolean merged) {
        ObjectNode root = base();
        root.put("action", action);
        root.put("number", number);
        ObjectNode pr = root.putObject("pull_request");
        pr.put("id", 80_000L + number);
        pr.put("number", number);
        pr.put("title", title);
        pr.put("body", description);
        pr.put("state", merged ? "closed" : "open");
        pr.put("draft", false);
        pr.put("merged", merged);
        if (merged) {
            pr.put("merged_at", updatedAt);
            pr.put("closed_at", updatedAt);
            pr.put("merge_commit_sha", "m" + number);
        }
        pr.put("html_url", "https://github.com/hcm26-java-team/webshop/pull/" + number);
        pr.putObject("user").put("login", "dev-a").put("id", 501L);
        pr.putObject("head").put("ref", branch).put("sha", "h" + number);
        pr.putObject("base").put("ref", "main");
        pr.put("created_at", "2026-11-17T08:00:00Z");
        pr.put("updated_at", updatedAt);
        return root;
    }

    protected void deliverAndProcess(String event, ObjectNode body) throws Exception {
        deliverAndProcess(event, json.writeValueAsString(body).getBytes(StandardCharsets.UTF_8));
    }

    /** A pull_request delivery of a payload serialized beforehand (safe to call from several threads). */
    protected void deliverAndProcessBytes(byte[] bytes) throws Exception {
        deliverAndProcess("pull_request", bytes);
    }

    private void deliverAndProcess(String event, byte[] bytes) throws Exception {
        String deliveryId = "delivery-" + UUID.randomUUID();
        mvc.perform(post("/api/webhooks/github").contentType(MediaType.APPLICATION_JSON).content(bytes)
                        .header("X-GitHub-Event", event)
                        .header("X-GitHub-Delivery", deliveryId)
                        .header("X-Hub-Signature-256", verifier.sign(SECRET, bytes)))
                .andExpect(status().isAccepted());
        processor.process(events.findByProviderAndDeliveryId(GitProvider.GITHUB, deliveryId).orElseThrow().getId());
    }

    protected static void runInParallel(List<Runnable> tasks) throws Exception {
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
