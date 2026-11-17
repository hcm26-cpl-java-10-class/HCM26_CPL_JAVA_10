package com.example.starter_project_2025.system.git_integration;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-SY-04 read APIs (activity, commits, pull requests) and the webhook delivery log with replay. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RepositoryActivityApiTest {

    private static final long GITHUB_INSTALLATION_ID = 445566L;
    private static final long REPO = 9201L;
    private static final LocalDateTime T0 = LocalDateTime.of(2026, 11, 17, 9, 0);

    @DynamicPropertySource
    static void githubApp(DynamicPropertyRegistry registry) {
        registry.add("app.github.webhook-dispatch-enabled", () -> "false");
        registry.add("app.github.webhook-poller-enabled", () -> "false");
        registry.add("app.github.sync-dispatch-enabled", () -> "false");
        registry.add("app.github.sync-poller-enabled", () -> "false");
    }

    @Autowired MockMvc mvc;
    @Autowired TransactionTemplate tx;
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

    @MockBean GitHubApiClient github;

    Long tenantId;
    Long masterId;
    Long moduleId;
    Long emptyMasterId;
    Long otherTenantProjectId;
    Long connectionId;
    String managerToken;
    String readerToken;
    String noPermissionToken;
    Long failedEventId;
    Long processedEventId;
    Long purgedEventId;
    Long otherTenantEventId;

    @BeforeEach
    void fixture() {
        reviews.deleteAll();
        pullRequests.deleteAll();
        commits.deleteAll();
        events.deleteAll();
        jobs.deleteAll();
        connections.deleteAll();
        installations.deleteAll();
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("SY4A-" + UUID.randomUUID()).name("SY-04 API").build());
            Tenant other = tenants.saveAndFlush(Tenant.builder().code("SY4A-O-" + UUID.randomUUID()).name("Other").build());
            tenantId = tenant.getId();
            managerToken = token(user(tenant, role("SY4-MANAGE-", "GIT_INTEGRATION_MANAGE")));
            readerToken = token(user(tenant, role("SY4-READ-", "GIT_INTEGRATION_READ")));
            noPermissionToken = token(user(tenant, role("SY4-NONE-")));

            Project master = project(tenant, "Shop", null);
            masterId = master.getId();
            moduleId = project(tenant, "Payment module", master).getId();
            emptyMasterId = project(tenant, "No repository yet", null).getId();
            otherTenantProjectId = project(other, "Other tenant project", null).getId();

            Long installationRow = installations.saveAndFlush(GitInstallation.builder()
                    .tenantId(tenantId).provider(GitProvider.GITHUB).installationId(GITHUB_INSTALLATION_ID)
                    .accountId(1L).accountLogin("hcm26-java-team").accountType("Organization").repositorySelection("selected")
                    .status(GitInstallationStatus.CONNECTED).connectedByUserId(1L)
                    .connectedAt(LocalDateTime.now()).lastVerifiedAt(LocalDateTime.now()).build()).getId();
            connectionId = connections.saveAndFlush(GitRepository.builder()
                    .tenantId(tenantId).projectId(masterId).installationRef(installationRow)
                    .provider(GitProvider.GITHUB).externalId(REPO).ownerLogin("hcm26-java-team").name("shop")
                    .fullName("hcm26-java-team/shop").htmlUrl("https://github.com/hcm26-java-team/shop")
                    .visibility("private").defaultBranch("main").status(GitRepositoryStatus.ACTIVE)
                    .linkedByUserId(1L).linkedAt(LocalDateTime.now()).build()).getId();

            commit("aaaaaaa1111", "feat: cart\n\nAdds the cart page", "dev-a", "refs/heads/main", 1);
            commit("bbbbbbb2222", "fix: totals", "dev-b", "refs/heads/feature/totals", 2);
            commit("ccccccc3333", "feat: checkout", "dev-a", "refs/heads/main", 3);

            GitPullRequest open = pullRequest(7, "Add cart", GitPullRequestState.OPEN, 10);
            pullRequest(8, "Fix totals", GitPullRequestState.MERGED, 20);
            pullRequest(9, "Spike", GitPullRequestState.CLOSED, 5);
            review(open, 1, "rev-1", GitReviewState.APPROVED, 1);
            review(open, 2, "rev-1", GitReviewState.COMMENTED, 2);          // a comment does not undo the approval
            review(open, 3, "rev-2", GitReviewState.CHANGES_REQUESTED, 1);
            review(open, 4, "rev-2", GitReviewState.DISMISSED, 3);          // ...but a dismissal does
            review(open, 5, "rev-3", GitReviewState.COMMENTED, 1);

            processedEventId = event("d-processed", tenantId, connectionId, GitWebhookEventStatus.PROCESSED, "{}");
            failedEventId = event("d-failed", tenantId, connectionId, GitWebhookEventStatus.FAILED, "{}");
            purgedEventId = event("d-purged", tenantId, connectionId, GitWebhookEventStatus.FAILED, null);
            event("d-retrying", tenantId, connectionId, GitWebhookEventStatus.FAILED_RETRYABLE, "{}");
            event("d-waiting", null, null, GitWebhookEventStatus.RECEIVED, "{}"); // not resolved yet: own installation
            otherTenantEventId = event("d-other", other.getId(), null, GitWebhookEventStatus.FAILED, "{}");
        });
    }

    // ---- activity / commits / pull requests ---------------------------------------------------------

    @Test
    void activitySummarizesTheRepositoryAndModulesSeeTheirMasters() throws Exception {
        for (Long projectId : new Long[]{masterId, moduleId}) {
            get(readerToken, "/projects/" + projectId + "/repository/activity")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.repositoryId").value(connectionId))
                    .andExpect(jsonPath("$.commitCount").value(3))
                    .andExpect(jsonPath("$.lastCommit.shortSha").value("ccccccc"))
                    .andExpect(jsonPath("$.lastCommit.headline").value("feat: checkout"))
                    .andExpect(jsonPath("$.lastCommit.branch").value("main"))
                    .andExpect(jsonPath("$.pullRequests.open").value(1))
                    .andExpect(jsonPath("$.pullRequests.merged").value(1))
                    .andExpect(jsonPath("$.pullRequests.closed").value(1))
                    .andExpect(jsonPath("$.pendingEvents").value(2)) // retrying + waiting (unresolved, same GitHub repo)
                    .andExpect(jsonPath("$.failedEvents").value(2))
                    .andExpect(jsonPath("$.lastEventAt").exists());
        }
    }

    @Test
    void projectWithoutRepositoryHasAnEmptyActivity() throws Exception {
        get(readerToken, "/projects/" + emptyMasterId + "/repository/activity")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repositoryId").doesNotExist())
                .andExpect(jsonPath("$.commitCount").value(0));
        get(readerToken, "/projects/" + emptyMasterId + "/repository/commits")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void commitsAreNewestFirstAndCanBeFiltered() throws Exception {
        get(readerToken, "/projects/" + masterId + "/repository/commits")
                .andExpect(jsonPath("$.items[*].shortSha", contains("ccccccc", "bbbbbbb", "aaaaaaa")))
                .andExpect(jsonPath("$.items[2].headline").value("feat: cart"))
                .andExpect(jsonPath("$.items[2].message").value("feat: cart\n\nAdds the cart page"));
        get(readerToken, "/projects/" + masterId + "/repository/commits?author=dev-a")
                .andExpect(jsonPath("$.totalElements").value(2));
        get(readerToken, "/projects/" + masterId + "/repository/commits?branch=feature/totals")
                .andExpect(jsonPath("$.items[*].shortSha", contains("bbbbbbb")));
        get(readerToken, "/projects/" + masterId + "/repository/commits?q=CHECKOUT")
                .andExpect(jsonPath("$.items[*].shortSha", contains("ccccccc")));
        get(readerToken, "/projects/" + masterId + "/repository/commits?size=2&page=1")
                .andExpect(jsonPath("$.items[*].shortSha", contains("aaaaaaa")))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void pullRequestsCountEachReviewersCurrentDecision() throws Exception {
        get(readerToken, "/projects/" + masterId + "/repository/pull-requests")
                .andExpect(jsonPath("$.items[*].number", contains(8, 7, 9))) // most recently updated first
                .andExpect(jsonPath("$.items[1].reviewSummary.approved").value(1))
                .andExpect(jsonPath("$.items[1].reviewSummary.changesRequested").value(0))
                .andExpect(jsonPath("$.items[1].reviewSummary.commented").value(1));
        get(readerToken, "/projects/" + masterId + "/repository/pull-requests?state=MERGED")
                .andExpect(jsonPath("$.items[*].number", contains(8)));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/git-integration/projects/" + masterId + "/repository/pull-requests")
                        .param("q", "#7").header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$.items[*].number", contains(7)));
        get(readerToken, "/projects/" + masterId + "/repository/pull-requests/7")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pullRequest.title").value("Add cart"))
                .andExpect(jsonPath("$.reviews[*].reviewerLogin", containsInAnyOrder("rev-1", "rev-1", "rev-2", "rev-2", "rev-3")));
        get(readerToken, "/projects/" + masterId + "/repository/pull-requests/404")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_PULL_REQUEST_NOT_FOUND"));
    }

    @Test
    void readApisAreAuthorizedAndTenantScoped() throws Exception {
        get(noPermissionToken, "/projects/" + masterId + "/repository/commits").andExpect(status().isForbidden());
        get(readerToken, "/projects/" + otherTenantProjectId + "/repository/activity")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_NOT_FOUND"));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/v1/git-integration/projects/" + masterId + "/repository/activity")).andExpect(status().isUnauthorized());
        get(readerToken, "/projects/" + masterId + "/repository/pull-requests?state=WHATEVER")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_REQUEST_INVALID"));
    }

    // ---- webhook delivery log and replay ----------------------------------------------------------

    @Test
    void webhookLogShowsTheTenantsDeliveriesWithoutPayloads() throws Exception {
        get(managerToken, "/webhook-events")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(5)) // other tenant's event hidden; unresolved one included
                .andExpect(jsonPath("$.items[*].deliveryId", containsInAnyOrder(
                        "d-processed", "d-failed", "d-purged", "d-retrying", "d-waiting")))
                .andExpect(jsonPath("$.items[0].payload").doesNotExist());
        get(managerToken, "/webhook-events?status=FAILED")
                .andExpect(jsonPath("$.items[*].deliveryId", containsInAnyOrder("d-failed", "d-purged")));
        get(managerToken, "/webhook-events?status=FAILED_RETRYABLE")
                .andExpect(jsonPath("$.items[0].retryCount").value(2))
                .andExpect(jsonPath("$.items[0].maxRetries").value(5))
                .andExpect(jsonPath("$.items[0].nextRetryAt").exists());
        get(managerToken, "/webhook-events?projectId=" + moduleId)
                .andExpect(jsonPath("$.totalElements").value(4)); // resolved to this project's connection
        get(readerToken, "/webhook-events").andExpect(status().isForbidden());
    }

    @Test
    void failedEventsCanBeReplayedOthersCannot() throws Exception {
        post(managerToken, "/webhook-events/" + failedEventId + "/replay")
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("queued"));
        GitWebhookEvent replayed = events.findById(failedEventId).orElseThrow();
        assertThat(replayed.getStatus()).isEqualTo(GitWebhookEventStatus.RECEIVED);
        assertThat(replayed.getAttempts()).isZero();
        assertThat(replayed.getLastError()).startsWith("Replayed by user #");

        post(managerToken, "/webhook-events/" + processedEventId + "/replay")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_EVENT_NOT_REPLAYABLE"));
        post(managerToken, "/webhook-events/" + purgedEventId + "/replay")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_PAYLOAD_PURGED"));
        post(managerToken, "/webhook-events/" + otherTenantEventId + "/replay")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_EVENT_NOT_FOUND"));
        post(readerToken, "/webhook-events/" + failedEventId + "/replay").andExpect(status().isForbidden());
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private ResultActions get(String token, String path) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/v1/git-integration" + path).header("Authorization", "Bearer " + token));
    }

    private ResultActions post(String token, String path) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .post("/api/v1/git-integration" + path).header("Authorization", "Bearer " + token));
    }

    private void commit(String sha, String message, String author, String ref, int hour) {
        commits.saveAndFlush(GitCommit.builder()
                .tenantId(tenantId).projectId(masterId).repositoryId(connectionId).repoExternalId(REPO)
                .sha(sha).message(message).authorName(author).authorLogin(author)
                .committedAt(T0.plusHours(hour)).firstSeenRef(ref).source(GitCommitSource.WEBHOOK_PAYLOAD)
                .ingestedEventId(1L).ingestedAt(LocalDateTime.now()).build());
    }

    private GitPullRequest pullRequest(int number, String title, GitPullRequestState state, int updatedHour) {
        return pullRequests.saveAndFlush(GitPullRequest.builder()
                .tenantId(tenantId).projectId(masterId).repositoryId(connectionId).repoExternalId(REPO)
                .externalId(70_000L + number).number(number).title(title).state(state).draft(false).authorLogin("dev-a")
                .githubCreatedAt(T0).githubUpdatedAt(T0.plusHours(updatedHour)).build());
    }

    private void review(GitPullRequest pr, long id, String reviewer, GitReviewState state, int hour) {
        reviews.saveAndFlush(GitPullRequestReview.builder()
                .tenantId(tenantId).projectId(masterId).repositoryId(connectionId).pullRequestId(pr.getId())
                .externalId(id).reviewerLogin(reviewer).state(state).submittedAt(T0.plusHours(hour))
                .sourceUpdatedAt(T0.plusHours(hour)).sourceActionRank(1).build());
    }

    private Long event(String deliveryId, Long tenant, Long repositoryRef, GitWebhookEventStatus status, String payload) {
        LocalDateTime received = LocalDateTime.now().minusMinutes(5);
        boolean finished = status.terminal();
        return events.saveAndFlush(GitWebhookEvent.builder()
                .provider(GitProvider.GITHUB).deliveryId(deliveryId).eventType("push")
                .installationId(GITHUB_INSTALLATION_ID).repoExternalId(REPO).repoFullName("hcm26-java-team/shop")
                .tenantId(tenant).repositoryRef(repositoryRef)
                .payload(payload).payloadBytes(payload == null ? 2 : payload.length())
                .payloadPurgedAt(payload == null ? LocalDateTime.now() : null)
                .status(status).attempts(status == GitWebhookEventStatus.FAILED_RETRYABLE ? 3 : finished ? 1 : 0)
                .nextAttemptAt(received.plusMinutes(10)).receivedAt(received)
                .processedAt(finished ? received.plusSeconds(1) : null).build()).getId();
    }

    private Project project(Tenant tenant, String name, Project parent) {
        Project project = new Project();
        project.setCode("PRJ-" + UUID.randomUUID());
        project.setName(name);
        project.setTenant(tenant);
        project.setStatus(ProjectStatus.ACTIVE);
        project.setParentProject(parent);
        return projects.saveAndFlush(project);
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
        user.setEmail(UUID.randomUUID() + "@sy4.test");
        user.setFirstName("Git");
        user.setLastName("Reader");
        user.setUserCode("SY4-" + UUID.randomUUID());
        user.setPasswordHash("unused-test-password");
        user.setTenant(tenant);
        user.setRoles(new HashSet<>(Set.of(role)));
        return users.saveAndFlush(user);
    }

    private String token(User user) {
        var principal = userDetails.loadUserByUsername(user.getEmail());
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
}
