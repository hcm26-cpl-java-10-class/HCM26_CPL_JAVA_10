package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.git_integration.service.GitInstallationWriter;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-SY-03 acceptance criteria through the real web, security and persistence layers. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GitHubWebhookIntegrationTest {

    private static final String SECRET = "test-webhook-secret";
    private static final String URL = "/api/webhooks/github";
    private static final long GITHUB_INSTALLATION_ID = 556677L;
    private static final long LINKED_REPO = 9001L;

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
        // Events are processed explicitly by the tests.
        registry.add("app.github.webhook-dispatch-enabled", () -> "false");
        registry.add("app.github.webhook-poller-enabled", () -> "false");
        registry.add("app.github.sync-dispatch-enabled", () -> "false");
        registry.add("app.github.sync-poller-enabled", () -> "false");
    }

    @Autowired MockMvc mvc;
    @Autowired TransactionTemplate tx;
    @Autowired TenantRepository tenants;
    @Autowired ProjectRepository projects;
    @Autowired GitInstallationRepository installations;
    @Autowired GitRepositoryRepository connections;
    @Autowired GitSyncJobRepository jobs;
    @Autowired GitWebhookEventRepository events;
    @Autowired GitWebhookEventProcessor processor;
    @Autowired GitWebhookEventStore store;
    @Autowired GitWebhookHandlerRegistry registry;
    @Autowired GitWebhookRetentionJob retention;
    @Autowired GitHubWebhookSignatureVerifier verifier;
    @Autowired GitHubAppProperties properties;

    @MockBean GitHubApiClient github;
    @SpyBean GitInstallationWriter installationWriter;

    Long installationRowId;
    Long connectionId;
    Long masterId;

    @BeforeEach
    void fixture() {
        doCallRealMethod().when(installationWriter).transition(anyLong(), any(), any(), anyString());
        events.deleteAll();
        jobs.deleteAll();
        connections.deleteAll();
        installations.deleteAll();
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("SY3-" + UUID.randomUUID()).name("SY-03 tenant").build());
            Project master = new Project();
            master.setCode("PRJ-W-" + UUID.randomUUID());
            master.setName("Webhook project");
            master.setTenant(tenant);
            master.setStatus(ProjectStatus.ACTIVE);
            masterId = projects.saveAndFlush(master).getId();
            installationRowId = installations.saveAndFlush(GitInstallation.builder()
                    .tenantId(tenant.getId()).provider(GitProvider.GITHUB).installationId(GITHUB_INSTALLATION_ID)
                    .accountId(1L).accountLogin("hcm26-java-team").accountType("Organization").repositorySelection("selected")
                    .status(GitInstallationStatus.CONNECTED).connectedByUserId(1L)
                    .connectedAt(LocalDateTime.now()).lastVerifiedAt(LocalDateTime.now()).build()).getId();
            connectionId = connections.saveAndFlush(GitRepository.builder()
                    .tenantId(tenant.getId()).projectId(masterId).installationRef(installationRowId)
                    .provider(GitProvider.GITHUB).externalId(LINKED_REPO).ownerLogin("hcm26-java-team").name("ecommerce")
                    .fullName("hcm26-java-team/ecommerce").htmlUrl("https://github.com/hcm26-java-team/ecommerce")
                    .visibility("private").defaultBranch("main").status(GitRepositoryStatus.ACTIVE)
                    .linkedByUserId(1L).linkedAt(LocalDateTime.now()).build()).getId();
        });
    }

    // ---- AC01 / AC02 / AC03: activity events are verified, stored and queued -----------------------

    @Test
    void ac01ValidPushIsStoredAsReceivedWithRoutingFields() throws Exception {
        String body = """
                {"ref":"refs/heads/main","repository":{"id":9001,"full_name":"hcm26-java-team/ecommerce"},
                 "installation":{"id":556677},"sender":{"login":"dev-a"},
                 "commits":[{"id":"a1b2c3","message":"feat: add cart"}]}""";

        deliver("push", "delivery-push-1", body)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.deliveryId").value("delivery-push-1"));

        GitWebhookEvent event = events.findByProviderAndDeliveryId(GitProvider.GITHUB, "delivery-push-1").orElseThrow();
        assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.RECEIVED);
        assertThat(event.getEventType()).isEqualTo("push");
        assertThat(event.getAction()).isNull();
        assertThat(event.getInstallationId()).isEqualTo(GITHUB_INSTALLATION_ID);
        assertThat(event.getRepoExternalId()).isEqualTo(LINKED_REPO);
        assertThat(event.getRepoFullName()).isEqualTo("hcm26-java-team/ecommerce");
        assertThat(event.getSenderLogin()).isEqualTo("dev-a");
        assertThat(event.getHookId()).isEqualTo(42L);
        assertThat(event.getPayload()).isEqualTo(body); // byte-for-byte
        assertThat(event.getPayloadBytes()).isEqualTo(body.getBytes(StandardCharsets.UTF_8).length);
        assertThat(event.getNextAttemptAt()).isNotNull();
    }

    @Test
    void ac02AndAc03PullRequestAndReviewEventsAreStoredWithTheirAction() throws Exception {
        deliver("pull_request", "delivery-pr-1", """
                {"action":"closed","pull_request":{"number":7,"merged":true},
                 "repository":{"id":9001,"full_name":"hcm26-java-team/ecommerce"},"installation":{"id":556677},"sender":{"login":"dev-a"}}""")
                .andExpect(status().isAccepted());
        deliver("pull_request_review", "delivery-review-1", """
                {"action":"submitted","review":{"state":"approved"},"pull_request":{"number":7},
                 "repository":{"id":9001},"installation":{"id":556677},"sender":{"login":"reviewer-b"}}""")
                .andExpect(status().isAccepted());

        GitWebhookEvent pr = events.findByProviderAndDeliveryId(GitProvider.GITHUB, "delivery-pr-1").orElseThrow();
        GitWebhookEvent review = events.findByProviderAndDeliveryId(GitProvider.GITHUB, "delivery-review-1").orElseThrow();
        assertThat(pr.getAction()).isEqualTo("closed");
        assertThat(pr.getStatus()).isEqualTo(GitWebhookEventStatus.RECEIVED);
        assertThat(review.getAction()).isEqualTo("submitted");
        assertThat(review.getSenderLogin()).isEqualTo("reviewer-b");
        assertThat(review.getStatus()).isEqualTo(GitWebhookEventStatus.RECEIVED);
    }

    @Test
    void noJwtIsNeededButOtherEndpointsStayProtected() throws Exception {
        deliver("ping", "delivery-ping", "{\"zen\":\"Keep it logically awesome.\",\"hook_id\":42}")
                .andExpect(status().isAccepted());
        mvc.perform(get("/api/v1/git-integration/github/installations")).andExpect(status().isUnauthorized());
    }

    @Test
    void unsubscribedEventIsStoredAsIgnored() throws Exception {
        deliver("ping", "delivery-ping-2", "{\"zen\":\"Design for failure.\"}").andExpect(status().isAccepted());

        GitWebhookEvent event = events.findByProviderAndDeliveryId(GitProvider.GITHUB, "delivery-ping-2").orElseThrow();
        assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.IGNORED);
        assertThat(event.getProcessedAt()).isNotNull();
    }

    @Test
    void largePayloadIsAcceptedWellWithinOneSecond() throws Exception {
        String filler = "x".repeat(1024 * 1024);
        String body = "{\"repository\":{\"id\":9001},\"installation\":{\"id\":556677},\"filler\":\"" + filler + "\"}";

        long started = System.nanoTime();
        deliver("push", "delivery-large", body).andExpect(status().isAccepted());
        long millis = (System.nanoTime() - started) / 1_000_000;

        assertThat(millis).isLessThan(1000);
        assertThat(events.findByProviderAndDeliveryId(GitProvider.GITHUB, "delivery-large").orElseThrow().getPayloadBytes())
                .isGreaterThan(1024 * 1024);
    }

    // ---- AC04: invalid signature --------------------------------------------------------------------

    @Test
    void ac04InvalidOrMissingSignatureIsRejectedAndNothingIsStored() throws Exception {
        String body = "{\"repository\":{\"id\":9001}}";

        mvc.perform(request("push", "delivery-bad-1", body).header("X-Hub-Signature-256",
                        verifier.sign("wrong-secret", body.getBytes(StandardCharsets.UTF_8))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_SIGNATURE_INVALID"));
        // Signed for a different body (tampered in transit).
        mvc.perform(request("push", "delivery-bad-2", body).header("X-Hub-Signature-256",
                        verifier.sign(SECRET, "{\"repository\":{\"id\":1}}".getBytes(StandardCharsets.UTF_8))))
                .andExpect(status().isUnauthorized());
        mvc.perform(request("push", "delivery-bad-3", body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_SIGNATURE_MISSING"));

        assertThat(events.count()).isZero();
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
        verifyNoInteractions(github);
    }

    @Test
    void missingHeadersOrNonJsonBodyAreBadRequests() throws Exception {
        String body = "{\"repository\":{\"id\":9001}}";
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body)
                        .header("X-GitHub-Event", "push")
                        .header("X-Hub-Signature-256", verifier.sign(SECRET, body.getBytes(StandardCharsets.UTF_8))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_HEADERS_INVALID"));
        deliver("push", "delivery-not-json", "not json").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_PAYLOAD_INVALID"));
        assertThat(events.count()).isZero();
    }

    @Test
    void withoutAWebhookSecretEverythingIsRejected() throws Exception {
        String previous = properties.getWebhookSecret();
        properties.setWebhookSecret("");
        try {
            deliver("push", "delivery-no-secret", "{}").andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_DISABLED"));
        } finally {
            properties.setWebhookSecret(previous);
        }
        assertThat(events.count()).isZero();
    }

    // ---- AC05: duplicate delivery -------------------------------------------------------------------

    @Test
    void ac05RedeliveryWithTheSameIdIsRecognisedAndNotProcessedAgain() throws Exception {
        String body = "{\"action\":\"suspend\",\"installation\":{\"id\":556677}}";
        deliver("installation", "delivery-dup", body).andExpect(status().isAccepted());
        Long id = events.findByProviderAndDeliveryId(GitProvider.GITHUB, "delivery-dup").orElseThrow().getId();
        processor.process(id);
        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);

        deliver("installation", "delivery-dup", body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("duplicate"));

        assertThat(events.count()).isEqualTo(1);
        GitWebhookEvent event = events.findById(id).orElseThrow();
        assertThat(event.getAttempts()).isEqualTo(1);
        assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
    }

    @Test
    void sameDeliveryArrivingTwiceAtOnceIsStoredOnce() throws Exception {
        String body = "{\"repository\":{\"id\":9001}}";
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Integer>> futures = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return deliver("push", "delivery-race", body).andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : futures) statuses.add(future.get());
            assertThat(statuses).containsExactlyInAnyOrder(202, 200);
        } finally {
            pool.shutdownNow();
        }
        assertThat(events.count()).isEqualTo(1);
    }

    // ---- AC06: processing failure -------------------------------------------------------------------

    @Test
    void ac06FailedProcessingIsRetriedAsynchronouslyAndTheEventIsKept() throws Exception {
        String body = "{\"action\":\"deleted\",\"installation\":{\"id\":556677}}";
        deliver("installation", "delivery-fail", body).andExpect(status().isAccepted());
        Long id = events.findByProviderAndDeliveryId(GitProvider.GITHUB, "delivery-fail").orElseThrow().getId();
        doThrow(new IllegalStateException("database is busy"))
                .when(installationWriter).transition(anyLong(), any(), any(), anyString());

        processor.process(id);

        GitWebhookEvent failed = events.findById(id).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(GitWebhookEventStatus.FAILED_RETRYABLE);
        assertThat(failed.getAttempts()).isEqualTo(1);
        assertThat(failed.getLastError()).contains("database is busy");
        assertThat(failed.getNextAttemptAt()).isAfter(LocalDateTime.now());
        assertThat(failed.getPayload()).isEqualTo(body);
        assertThat(failed.getTenantId()).isNotNull();
        processor.process(id); // not due yet: nothing happens
        assertThat(events.findById(id).orElseThrow().getAttempts()).isEqualTo(1);

        // The retry succeeds once the cause is gone.
        doCallRealMethod().when(installationWriter).transition(anyLong(), any(), any(), anyString());
        makeDue(id);
        assertThat(store.dueIds(registry.handledTypes(), 50)).contains(id);
        processor.process(id);

        GitWebhookEvent processed = events.findById(id).orElseThrow();
        assertThat(processed.getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
        assertThat(processed.getAttempts()).isEqualTo(2);
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.DISCONNECTED);
    }

    @Test
    void ac06EventFailsForGoodAfterTheLastRetry() throws Exception {
        deliver("installation", "delivery-dead", "{\"action\":\"suspend\",\"installation\":{\"id\":556677}}")
                .andExpect(status().isAccepted());
        Long id = events.findByProviderAndDeliveryId(GitProvider.GITHUB, "delivery-dead").orElseThrow().getId();
        doThrow(new IllegalStateException("still failing"))
                .when(installationWriter).transition(anyLong(), any(), any(), anyString());

        int runs = properties.getWebhookMaxRetries() + 1; // first run + 5 retries
        for (int attempt = 1; attempt <= runs; attempt++) {
            makeDue(id);
            processor.process(id);
            if (attempt < runs) {
                assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.FAILED_RETRYABLE);
            }
        }

        GitWebhookEvent failed = events.findById(id).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(GitWebhookEventStatus.FAILED);
        assertThat(failed.getAttempts()).isEqualTo(runs);
        assertThat(failed.getPayload()).isNotNull();
        makeDue(id);
        processor.process(id);
        assertThat(events.findById(id).orElseThrow().getAttempts()).isEqualTo(runs);
    }

    // ---- AC07: app permission events ----------------------------------------------------------------

    @Test
    void ac07UninstalledAppDisconnectsInstallationAndItsLinkedRepositories() throws Exception {
        Long id = deliverAndProcess("installation", "{\"action\":\"deleted\",\"installation\":{\"id\":556677}}");

        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
        assertThat(events.findById(id).orElseThrow().getInstallationRef()).isEqualTo(installationRowId);
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.DISCONNECTED);
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.DISCONNECTED);
        assertThat(connections.findFirstByProjectIdAndStatus(masterId, GitRepositoryStatus.ACTIVE)).isEmpty();
        // GI-05: still the master's repository (the PM is warned and unlinks it to change repositories).
        assertThat(connections.findCurrent(masterId)).map(row -> row.getId()).contains(connectionId);
    }

    @Test
    void ac07SuspendAndUnsuspendFollowTheInstallationStateMachine() throws Exception {
        deliverAndProcess("installation", "{\"action\":\"suspend\",\"installation\":{\"id\":556677}}");
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.SUSPENDED);

        deliverAndProcess("installation", "{\"action\":\"unsuspend\",\"installation\":{\"id\":556677}}");
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.CONNECTED);
    }

    @Test
    void ac07LateUnsuspendDoesNotReviveARemovedInstallation() throws Exception {
        tx.executeWithoutResult(status -> installations.findById(installationRowId).orElseThrow()
                .setStatus(GitInstallationStatus.DISCONNECTED));

        Long id = deliverAndProcess("installation", "{\"action\":\"unsuspend\",\"installation\":{\"id\":556677}}");

        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.IGNORED);
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.DISCONNECTED);
    }

    @Test
    void ac07RepositoryRemovedFromTheAppBecomesDisconnected() throws Exception {
        Long id = deliverAndProcess("installation_repositories", """
                {"action":"removed","repository_selection":"selected","installation":{"id":556677},
                 "repositories_added":[],"repositories_removed":[{"id":9001,"full_name":"hcm26-java-team/ecommerce"}]}""");

        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.DISCONNECTED);
        assertThat(connections.findById(connectionId).orElseThrow().getStatusReason()).isEqualTo("REPOSITORY_ACCESS_REMOVED");
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.CONNECTED);
    }

    @Test
    void ac07RepositoriesAddedUpdatesTheSelection() throws Exception {
        deliverAndProcess("installation_repositories", """
                {"action":"added","repository_selection":"all","installation":{"id":556677},
                 "repositories_added":[{"id":1234}],"repositories_removed":[]}""");

        assertThat(installations.findById(installationRowId).orElseThrow().getRepositorySelection()).isEqualTo("all");
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
    }

    @Test
    void eventsOfAnUnknownInstallationAreIgnored() throws Exception {
        Long id = deliverAndProcess("installation", "{\"action\":\"deleted\",\"installation\":{\"id\":123123}}");

        GitWebhookEvent event = events.findById(id).orElseThrow();
        assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.IGNORED);
        assertThat(event.getLastError()).isEqualTo("Unknown installation");
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.CONNECTED);
    }

    @Test
    void renamedRepositoryRefreshesTheLinkedSnapshot() throws Exception {
        deliverAndProcess("repository", """
                {"action":"renamed","installation":{"id":556677},
                 "repository":{"id":9001,"name":"shop","full_name":"hcm26-java-team/shop","owner":{"login":"hcm26-java-team"},
                               "html_url":"https://github.com/hcm26-java-team/shop","visibility":"private","default_branch":"main"}}""");

        GitRepository connection = connections.findById(connectionId).orElseThrow();
        assertThat(connection.getName()).isEqualTo("shop");
        assertThat(connection.getFullName()).isEqualTo("hcm26-java-team/shop");
        assertThat(connection.getHtmlUrl()).isEqualTo("https://github.com/hcm26-java-team/shop");
        assertThat(connection.getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
    }

    // ---- Payload retention --------------------------------------------------------------------------

    @Test
    void retentionPurgesOnlyOldPayloadsOfFinishedEvents() {
        Long oldProcessed = storedEvent("old-processed", GitWebhookEventStatus.PROCESSED, 20);
        Long oldFailed = storedEvent("old-failed", GitWebhookEventStatus.FAILED_RETRYABLE, 20);
        Long recentProcessed = storedEvent("recent-processed", GitWebhookEventStatus.PROCESSED, 3);

        retention.purge();

        GitWebhookEvent purged = events.findById(oldProcessed).orElseThrow();
        assertThat(purged.getPayload()).isNull();
        assertThat(purged.getPayloadPurgedAt()).isNotNull();
        assertThat(purged.getDeliveryId()).isEqualTo("old-processed"); // the row stays
        assertThat(events.findById(oldFailed).orElseThrow().getPayload()).isNotNull();
        assertThat(events.findById(recentProcessed).orElseThrow().getPayload()).isNotNull();
        assertThat(properties.getWebhookPayloadRetentionDays()).isEqualTo(15);
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private Long deliverAndProcess(String event, String body) throws Exception {
        String deliveryId = "delivery-" + UUID.randomUUID();
        deliver(event, deliveryId, body).andExpect(status().isAccepted());
        Long id = events.findByProviderAndDeliveryId(GitProvider.GITHUB, deliveryId).orElseThrow().getId();
        processor.process(id);
        return id;
    }

    private Long storedEvent(String deliveryId, GitWebhookEventStatus status, int daysAgo) {
        LocalDateTime received = LocalDateTime.now().minusDays(daysAgo);
        return events.saveAndFlush(GitWebhookEvent.builder()
                .provider(GitProvider.GITHUB).deliveryId(deliveryId).eventType("push").payload("{\"a\":1}").payloadBytes(7)
                .status(status).nextAttemptAt(received).receivedAt(received).build()).getId();
    }

    private void makeDue(Long id) {
        tx.executeWithoutResult(status -> events.findById(id).orElseThrow().setNextAttemptAt(LocalDateTime.now().minusSeconds(1)));
    }

    private ResultActions deliver(String event, String deliveryId, String body) throws Exception {
        return mvc.perform(request(event, deliveryId, body)
                .header("X-Hub-Signature-256", verifier.sign(SECRET, body.getBytes(StandardCharsets.UTF_8))));
    }

    private static MockHttpServletRequestBuilder request(String event, String deliveryId, String body) {
        return post(URL).contentType(MediaType.APPLICATION_JSON).content(body.getBytes(StandardCharsets.UTF_8))
                .header("X-GitHub-Event", event)
                .header("X-GitHub-Delivery", deliveryId)
                .header("X-GitHub-Hook-ID", "42")
                .header("User-Agent", "GitHub-Hookshot/test");
    }
}
