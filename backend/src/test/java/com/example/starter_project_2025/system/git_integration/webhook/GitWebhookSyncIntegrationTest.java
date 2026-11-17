package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.config.GitWebhookAsyncConfig;
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
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCompareResult;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.ingestion.event.CommitIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.PullRequestIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.ReviewIngestedEvent;
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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-SY-04 acceptance criteria: webhook events become commits, pull requests and reviews. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@RecordApplicationEvents
@Import(GitWebhookSyncIntegrationTest.AsyncProbeConfig.class)
class GitWebhookSyncIntegrationTest {

    private static final String SECRET = "test-webhook-secret";
    private static final long GITHUB_INSTALLATION_ID = 778899L;
    private static final long LINKED_REPO = 9101L;
    private static final long OTHER_REPO = 9102L;
    private static final String BEFORE = "1111111111111111111111111111111111111111";
    private static final String AFTER = "2222222222222222222222222222222222222222";
    private static final String ZERO = "0000000000000000000000000000000000000000";

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
        // Events are processed explicitly, except in the fast-path test which turns dispatch on.
        registry.add("app.github.webhook-dispatch-enabled", () -> "false");
        registry.add("app.github.webhook-poller-enabled", () -> "false");
        registry.add("app.github.sync-dispatch-enabled", () -> "false");
        registry.add("app.github.sync-poller-enabled", () -> "false");
        registry.add("app.github.push-max-api-pages", () -> "5");
    }

    @Autowired MockMvc mvc;
    @Autowired TransactionTemplate tx;
    @Autowired ObjectMapper json;
    @Autowired TenantRepository tenants;
    @Autowired ProjectRepository projects;
    @Autowired GitInstallationRepository installations;
    @Autowired GitRepositoryRepository connections;
    @Autowired GitSyncJobRepository jobs;
    @Autowired GitWebhookEventRepository events;
    @Autowired GitCommitRepository commits;
    @Autowired GitPullRequestRepository pullRequests;
    @Autowired GitPullRequestReviewRepository reviews;
    @Autowired GitWebhookEventProcessor processor;
    @Autowired GitWebhookEventStore store;
    @Autowired GitWebhookEventPoller poller;
    @Autowired GitWebhookHandlerRegistry registry;
    @Autowired GitHubWebhookSignatureVerifier verifier;
    @Autowired GitHubAppProperties properties;
    @Autowired ApplicationEvents applicationEvents;
    @Autowired AsyncProbe asyncProbe;
    @Autowired @Qualifier(GitWebhookAsyncConfig.WEBHOOK_EXECUTOR) ThreadPoolTaskExecutor webhookExecutor;

    @Autowired InstallationTokenProvider tokens;

    @MockBean GitHubApiClient github;

    Long installationRowId;
    Long connectionId;
    Long masterId;

    @BeforeEach
    void fixture() {
        reviews.deleteAll();
        pullRequests.deleteAll();
        commits.deleteAll();
        events.deleteAll();
        jobs.deleteAll();
        connections.deleteAll();
        installations.deleteAll();
        tokens.invalidate(GITHUB_INSTALLATION_ID); // tokens are cached in memory across tests
        when(github.createContentsToken(anyLong())).thenReturn(new GitHubInstallationToken("contents-token",
                Instant.now().plus(Duration.ofHours(1))));
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("SY4-" + UUID.randomUUID()).name("SY-04 tenant").build());
            Project master = new Project();
            master.setCode("PRJ-S-" + UUID.randomUUID());
            master.setName("Sync project");
            master.setTenant(tenant);
            master.setStatus(ProjectStatus.ACTIVE);
            masterId = projects.saveAndFlush(master).getId();
            installationRowId = installations.saveAndFlush(GitInstallation.builder()
                    .tenantId(tenant.getId()).provider(GitProvider.GITHUB).installationId(GITHUB_INSTALLATION_ID)
                    .accountId(1L).accountLogin("hcm26-java-team").accountType("Organization").repositorySelection("selected")
                    .status(GitInstallationStatus.CONNECTED).connectedByUserId(1L)
                    .connectedAt(LocalDateTime.now()).lastVerifiedAt(LocalDateTime.now()).build()).getId();
            connectionId = connections.saveAndFlush(connection(tenant.getId(), LINKED_REPO, GitRepositoryStatus.ACTIVE)).getId();
        });
    }

    // ---- AC01: commits ------------------------------------------------------------------------------

    @Test
    void ac01PushStoresItsCommitsAndPublishesOneEvent() throws Exception {
        Long id = deliverAndProcess("push", push("refs/heads/main", BEFORE, AFTER, "c1", "c2", "c3"));

        GitWebhookEvent event = events.findById(id).orElseThrow();
        assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
        assertThat(event.getRepositoryRef()).isEqualTo(connectionId);
        assertThat(event.getLastError()).contains("inserted=3").contains("source=WEBHOOK_PAYLOAD");
        List<GitCommit> stored = commits.findAll();
        assertThat(stored).extracting(GitCommit::getSha).containsExactlyInAnyOrder("c1", "c2", "c3");
        GitCommit c1 = stored.stream().filter(c -> c.getSha().equals("c1")).findFirst().orElseThrow();
        assertThat(c1.getFirstSeenRef()).isEqualTo("refs/heads/main");
        assertThat(c1.getProjectId()).isEqualTo(masterId);
        assertThat(c1.getAuthorLogin()).isEqualTo("dev-a");
        assertThat(c1.getMessage()).isEqualTo("feat: c1");
        assertThat(c1.getFilesChanged()).isEqualTo(2);
        assertThat(c1.getSource()).isEqualTo(GitCommitSource.WEBHOOK_PAYLOAD);
        assertThat(c1.getIngestedEventId()).isEqualTo(id);
        assertThat(applicationEvents.stream(CommitIngestedEvent.class).toList()).singleElement()
                .satisfies(e -> assertThat(e.commitIds()).hasSize(3));
        verifyNoInteractions(github); // a complete payload needs no API call
    }

    @Test
    void commitsAreImmutableBySha() throws Exception {
        deliverAndProcess("push", push("refs/heads/feature/cart", BEFORE, AFTER, "c1", "c2"));
        // The same commits later reach main (merge) together with a new one; a replay brings nothing new.
        Long merged = deliverAndProcess("push", push("refs/heads/main", BEFORE, AFTER, "c1", "c2", "c3"));
        Long replay = deliverAndProcess("push", push("refs/heads/main", BEFORE, AFTER, "c1", "c2", "c3"));

        assertThat(commits.count()).isEqualTo(3);
        assertThat(commits.findAll()).filteredOn(c -> !c.getSha().equals("c3"))
                .allSatisfy(c -> assertThat(c.getFirstSeenRef()).isEqualTo("refs/heads/feature/cart"));
        assertThat(events.findById(merged).orElseThrow().getLastError()).contains("inserted=1, existing=2");
        assertThat(events.findById(replay).orElseThrow().getLastError()).contains("inserted=0, existing=3");
        assertThat(applicationEvents.stream(CommitIngestedEvent.class).count()).isEqualTo(2); // nothing for the replay
    }

    @Test
    void tagPushesAreIgnoredAndDeletedBranchesStoreNothing() throws Exception {
        Long tag = deliverAndProcess("push", push("refs/tags/v1.0", ZERO, AFTER, "c1"));
        ObjectNode deleted = push("refs/heads/old", BEFORE, ZERO);
        deleted.put("deleted", true);
        Long branch = deliverAndProcess("push", deleted);

        assertThat(events.findById(tag).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.IGNORED);
        assertThat(events.findById(branch).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
        assertThat(commits.count()).isZero();
    }

    @Test
    void truncatedPushIsCompletedWithTheCompareApi() throws Exception {
        for (int page = 1; page <= 3; page++) { // 100 + 100 + 40
            when(github.compareCommits("contents-token", "hcm26-java-team", "ecommerce", BEFORE, AFTER, page))
                    .thenReturn(new GitHubCompareResult("ahead", 240, 240, apiCommits("x", (page - 1) * 100, Math.min(page * 100, 240))));
        }

        Long id = deliverAndProcess("push", truncatedPush(BEFORE));

        assertThat(commits.count()).isEqualTo(240);
        assertThat(commits.findAll()).allSatisfy(c -> assertThat(c.getSource()).isEqualTo(GitCommitSource.COMPARE_API));
        assertThat(events.findById(id).orElseThrow().getLastError()).contains("inserted=240").contains("apiPages=3");
        verify(github, never()).listCommits(anyString(), anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    void truncatedPushBeyondCompareLimitWalksTheHistoryDownToBefore() throws Exception {
        when(github.compareCommits("contents-token", "hcm26-java-team", "ecommerce", BEFORE, AFTER, 1))
                .thenReturn(new GitHubCompareResult("ahead", 3000, 3000, apiCommits("x", 0, 100)));
        List<GitHubCommit> page3 = new ArrayList<>(apiCommits("y", 200, 250));
        page3.add(apiCommit(BEFORE));
        page3.addAll(apiCommits("old", 0, 10));
        when(github.listCommits("contents-token", "hcm26-java-team", "ecommerce", AFTER, 1)).thenReturn(apiCommits("y", 0, 100));
        when(github.listCommits("contents-token", "hcm26-java-team", "ecommerce", AFTER, 2)).thenReturn(apiCommits("y", 100, 200));
        when(github.listCommits("contents-token", "hcm26-java-team", "ecommerce", AFTER, 3)).thenReturn(page3);

        Long id = deliverAndProcess("push", truncatedPush(BEFORE));

        assertThat(commits.count()).isEqualTo(250); // stops at `before`, never stores older history
        assertThat(commits.findAll()).allSatisfy(c -> assertThat(c.getSource()).isEqualTo(GitCommitSource.LIST_COMMITS_API));
        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
    }

    @Test
    void truncatedPushOfANewBranchStopsAtKnownHistory() throws Exception {
        deliverAndProcess("push", push("refs/heads/main", BEFORE, AFTER, "known-1"));
        List<GitHubCommit> page2 = new ArrayList<>(apiCommits("n", 100, 150));
        page2.add(apiCommit("known-1"));
        when(github.listCommits("contents-token", "hcm26-java-team", "ecommerce", AFTER, 1)).thenReturn(apiCommits("n", 0, 100));
        when(github.listCommits("contents-token", "hcm26-java-team", "ecommerce", AFTER, 2)).thenReturn(page2);

        deliverAndProcess("push", truncatedPush(ZERO));

        assertThat(commits.count()).isEqualTo(1 + 150);
        verify(github, never()).listCommits(anyString(), anyString(), anyString(), anyString(), eq(3));
    }

    // ---- AC02 / AC05: pull requests and reviews --------------------------------------------------

    @Test
    void ac02PullRequestIsCreatedThenMerged() throws Exception {
        deliverAndProcess("pull_request", pullRequestEvent("opened", 7, "open", false, "2026-11-17T10:00:00Z"));
        GitPullRequest opened = pullRequests.findByRepositoryIdAndNumber(connectionId, 7).orElseThrow();
        assertThat(opened.getState()).isEqualTo(GitPullRequestState.OPEN);
        assertThat(opened.getTitle()).isEqualTo("Add cart");
        assertThat(opened.getAuthorLogin()).isEqualTo("dev-a");
        assertThat(opened.getAdditions()).isEqualTo(120);

        Long closed = deliverAndProcess("pull_request", pullRequestEvent("closed", 7, "closed", true, "2026-11-17T11:00:00Z"));

        GitPullRequest merged = pullRequests.findByRepositoryIdAndNumber(connectionId, 7).orElseThrow();
        assertThat(merged.getState()).isEqualTo(GitPullRequestState.MERGED);
        assertThat(merged.getMergedAt()).isNotNull();
        assertThat(merged.getLastAction()).isEqualTo("closed");
        assertThat(merged.getLastEventId()).isEqualTo(closed);
        assertThat(pullRequests.count()).isEqualTo(1);
        assertThat(applicationEvents.stream(PullRequestIngestedEvent.class).map(PullRequestIngestedEvent::created))
                .containsExactly(true, false);
    }

    @Test
    void ac05OlderPullRequestEventDoesNotOverwriteNewerData() throws Exception {
        deliverAndProcess("pull_request", pullRequestEvent("closed", 8, "closed", true, "2026-11-17T11:00:00Z"));
        Long late = deliverAndProcess("pull_request", pullRequestEvent("opened", 8, "open", false, "2026-11-17T10:00:00Z"));

        GitPullRequest stored = pullRequests.findByRepositoryIdAndNumber(connectionId, 8).orElseThrow();
        assertThat(stored.getState()).isEqualTo(GitPullRequestState.MERGED);
        GitWebhookEvent event = events.findById(late).orElseThrow();
        assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
        assertThat(event.getLastError()).startsWith("Stale event skipped");
        assertThat(applicationEvents.stream(PullRequestIngestedEvent.class).count()).isEqualTo(1);
    }

    @Test
    void eventsOfOnePullRequestProcessedInParallelKeepTheNewest() throws Exception {
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            ids.add(deliver("pull_request", pullRequestEvent("edited", 9, "open", false,
                    "2026-11-17T10:0" + i + ":00Z")));
        }
        runInParallel(ids.stream().<Runnable>map(id -> () -> processor.process(id)).toList());

        assertThat(pullRequests.count()).isEqualTo(1);
        assertThat(pullRequests.findByRepositoryIdAndNumber(connectionId, 9).orElseThrow().getGithubUpdatedAt())
                .isEqualTo(LocalDateTime.ofInstant(Instant.parse("2026-11-17T10:05:00Z"), java.time.ZoneId.systemDefault()));
        assertThat(ids).allSatisfy(id -> assertThat(events.findById(id).orElseThrow().getStatus())
                .isEqualTo(GitWebhookEventStatus.PROCESSED));
    }

    @Test
    void ac02ReviewIsStoredWithItsPullRequestEvenWhenItArrivesFirst() throws Exception {
        deliverAndProcess("pull_request_review", reviewEvent("submitted", 501, "approved", 10, "2026-11-17T10:00:00Z"));

        GitPullRequest pr = pullRequests.findByRepositoryIdAndNumber(connectionId, 10).orElseThrow();
        GitPullRequestReview review = reviews.findByRepositoryIdAndExternalId(connectionId, 501L).orElseThrow();
        assertThat(review.getPullRequestId()).isEqualTo(pr.getId());
        assertThat(review.getState()).isEqualTo(GitReviewState.APPROVED);
        assertThat(review.getReviewerLogin()).isEqualTo("reviewer-b");
        assertThat(applicationEvents.stream(ReviewIngestedEvent.class).count()).isEqualTo(1);
    }

    @Test
    void ac05DismissalArrivingBeforeTheSubmissionIsKept() throws Exception {
        deliverAndProcess("pull_request_review", reviewEvent("dismissed", 502, "dismissed", 11, "2026-11-17T10:30:00Z"));
        Long late = deliverAndProcess("pull_request_review", reviewEvent("submitted", 502, "changes_requested", 11,
                "2026-11-17T10:30:00Z")); // same pull request updated_at, lower action rank

        assertThat(reviews.findByRepositoryIdAndExternalId(connectionId, 502L).orElseThrow().getState())
                .isEqualTo(GitReviewState.DISMISSED);
        assertThat(events.findById(late).orElseThrow().getLastError()).startsWith("Stale review event skipped");

        deliverAndProcess("pull_request_review", reviewEvent("edited", 502, "commented", 11, "2026-11-17T12:00:00Z"));
        assertThat(reviews.findByRepositoryIdAndExternalId(connectionId, 502L).orElseThrow().getState())
                .isEqualTo(GitReviewState.COMMENTED); // genuinely newer data wins
    }

    // ---- AC03: unrelated repositories ------------------------------------------------------------

    @Test
    void ac03EventsOfUnlinkedOrInactiveRepositoriesAreIgnored() throws Exception {
        Long unlinked = deliverAndProcess("push", push("refs/heads/main", BEFORE, AFTER, OTHER_REPO, "c1"));
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.INACTIVE));
        Long inactive = deliverAndProcess("pull_request", pullRequestEvent("opened", 7, "open", false, "2026-11-17T10:00:00Z"));
        Long review = deliverAndProcess("pull_request_review", reviewEvent("submitted", 503, "approved", 7, "2026-11-17T10:00:00Z"));

        for (Long id : List.of(unlinked, inactive, review)) {
            GitWebhookEvent event = events.findById(id).orElseThrow();
            assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.IGNORED);
            assertThat(event.getLastError()).isEqualTo("Repository is not linked to a project or is not active");
        }
        assertThat(commits.count()).isZero();
        assertThat(pullRequests.count()).isZero();
        assertThat(reviews.count()).isZero();
        assertThat(applicationEvents.stream(CommitIngestedEvent.class)).isEmpty();
    }

    // ---- AC04: retry, backoff and fallback --------------------------------------------------------

    @Test
    void ac04TransientGitHubErrorsAreRetriedWithBackoffThenFail() throws Exception {
        when(github.compareCommits(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "compare commits", 502));
        Long id = deliver("push", truncatedPush(BEFORE));

        processor.process(id);
        GitWebhookEvent first = events.findById(id).orElseThrow();
        assertThat(first.getStatus()).isEqualTo(GitWebhookEventStatus.FAILED_RETRYABLE);
        assertThat(first.getAttempts()).isEqualTo(1);
        assertThat(first.getNextAttemptAt()).isBetween(LocalDateTime.now().plusSeconds(50), LocalDateTime.now().plusSeconds(70));
        assertThat(first.getLastError()).contains("UNAVAILABLE");

        for (int retry = 1; retry <= properties.getWebhookMaxRetries(); retry++) {
            makeDue(id);
            assertThat(store.dueIds(registry.handledTypes(), 50)).contains(id);
            processor.process(id);
        }
        GitWebhookEvent failed = events.findById(id).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(GitWebhookEventStatus.FAILED);
        assertThat(failed.getAttempts()).isEqualTo(6); // first run + 5 retries
        assertThat(failed.getPayload()).isNotNull();
        assertThat(store.dueIds(registry.handledTypes(), 50)).doesNotContain(id);
    }

    @Test
    void ac04RateLimitWaitsAsLongAsGitHubAsksAndSucceedsLater() throws Exception {
        when(github.compareCommits(anyString(), anyString(), anyString(), anyString(), anyString(), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.RATE_LIMITED, "compare commits", 403, 900L))
                .thenReturn(new GitHubCompareResult("ahead", 2, 2, apiCommits("r", 0, 2)));
        Long id = deliver("push", truncatedPush(BEFORE));

        processor.process(id);
        assertThat(events.findById(id).orElseThrow().getNextAttemptAt())
                .isAfter(LocalDateTime.now().plusSeconds(850)); // 15 minutes, not the 1-minute backoff
        makeDue(id);
        processor.process(id);

        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
        assertThat(commits.count()).isEqualTo(2);
    }

    @Test
    void ac04MissingPermissionFailsAtOnce() throws Exception {
        when(github.createContentsToken(anyLong()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.REJECTED, "create contents token", 422));
        Long id = deliver("push", truncatedPush(BEFORE));

        processor.process(id);

        GitWebhookEvent event = events.findById(id).orElseThrow();
        assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.FAILED);
        assertThat(event.getAttempts()).isEqualTo(1);
        assertThat(event.getLastError()).contains("Contents");
    }

    @Test
    void ac04FallbackSchedulerTakesReceivedEventsOnlyAfterTheGracePeriod() throws Exception {
        Long id = deliver("pull_request", pullRequestEvent("opened", 12, "open", false, "2026-11-17T10:00:00Z"));
        assertThat(store.dueIds(registry.handledTypes(), 50)).doesNotContain(id); // the fast path's turn

        tx.executeWithoutResult(status -> {
            GitWebhookEvent event = events.findById(id).orElseThrow();
            event.setNextAttemptAt(LocalDateTime.now().minusSeconds(11));
        });
        assertThat(store.dueIds(registry.handledTypes(), 50)).contains(id);

        properties.setWebhookPollerEnabled(true);
        try {
            poller.poll();
            awaitStatus(id, GitWebhookEventStatus.PROCESSED);
        } finally {
            properties.setWebhookPollerEnabled(false);
        }
        assertThat(pullRequests.findByRepositoryIdAndNumber(connectionId, 12)).isPresent();
    }

    @Test
    void ac01FastPathProcessesTheEventRightAfterItIsStored() throws Exception {
        properties.setWebhookDispatchEnabled(true);
        try {
            Long id = deliver("pull_request", pullRequestEvent("opened", 13, "open", false, "2026-11-17T10:00:00Z"));
            awaitStatus(id, GitWebhookEventStatus.PROCESSED);
        } finally {
            properties.setWebhookDispatchEnabled(false);
        }
        assertThat(pullRequests.findByRepositoryIdAndNumber(connectionId, 13)).isPresent();
    }

    @Test
    void discardedTasksAreNotLostTheEventWaitsForTheScheduler() throws Exception {
        GitHubAppProperties small = new GitHubAppProperties();
        small.setWebhookWorkerCore(1);
        small.setWebhookWorkerMax(1);
        small.setWebhookQueueCapacity(1);
        ThreadPoolTaskExecutor executor = new GitWebhookAsyncConfig().gitWebhookTaskExecutor(small);
        executor.initialize();
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger ran = new AtomicInteger();
        try {
            for (int i = 0; i < 3; i++) {
                executor.execute(() -> {
                    try {
                        release.await(5, TimeUnit.SECONDS);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    ran.incrementAndGet();
                }); // the third is discarded silently (no exception reaches the request thread)
            }
            release.countDown();
        } finally {
            executor.shutdown();
        }
        assertThat(ran.get()).isEqualTo(2);
    }

    @Test
    void otherAsyncMethodsDoNotRunOnTheWebhookPool() throws Exception {
        assertThat(asyncProbe.threadName().get(5, TimeUnit.SECONDS)).doesNotStartWith("git-webhook-");
        assertThat(webhookExecutor.getThreadNamePrefix()).isEqualTo("git-webhook-");
    }

    // ---- AC06: concurrent workers ----------------------------------------------------------------

    @Test
    void ac06AWorkerSkipsAnEventLockedByAnotherWithoutWaiting() throws Exception {
        Long id = deliver("pull_request", pullRequestEvent("opened", 14, "open", false, "2026-11-17T10:00:00Z"));
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<?> holder = pool.submit(() -> tx.executeWithoutResult(status -> {
                assertThat(events.lockRunnable(id, LocalDateTime.now())).hasSize(1);
                locked.countDown();
                try {
                    release.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(locked.await(5, TimeUnit.SECONDS)).isTrue();

            long started = System.nanoTime();
            Optional<GitWebhookEventStore.Claimed> second = store.claim(id, registry.handledTypes());
            long millis = (System.nanoTime() - started) / 1_000_000;

            assertThat(second).isEmpty();
            assertThat(millis).isLessThan(1000); // SKIP LOCKED: no waiting for the lock
            release.countDown();
            holder.get(10, TimeUnit.SECONDS);
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.RECEIVED);
        assertThat(store.claim(id, registry.handledTypes())).isPresent(); // free again once the lock is gone
    }

    @Test
    void ac06FastPathAndSchedulerRacingForOneEventRunItOnce() throws Exception {
        for (int round = 0; round < 10; round++) {
            Long id = deliver("pull_request", pullRequestEvent("opened", 100 + round, "open", false, "2026-11-17T10:00:00Z"));
            List<Future<Optional<GitWebhookEventStore.Claimed>>> claims = new ArrayList<>();
            ExecutorService pool = Executors.newFixedThreadPool(2);
            CountDownLatch start = new CountDownLatch(1);
            try {
                for (int worker = 0; worker < 2; worker++) {
                    claims.add(pool.submit(() -> {
                        start.await();
                        try {
                            return store.claim(id, registry.handledTypes());
                        } catch (org.springframework.dao.OptimisticLockingFailureException lost) {
                            return Optional.empty();
                        }
                    }));
                }
                start.countDown();
                int winners = 0;
                for (Future<Optional<GitWebhookEventStore.Claimed>> claim : claims) {
                    if (claim.get(10, TimeUnit.SECONDS).isPresent()) winners++;
                }
                assertThat(winners).isEqualTo(1);
            } finally {
                pool.shutdownNow();
            }
            assertThat(events.findById(id).orElseThrow().getAttempts()).isEqualTo(1);
        }
    }

    // ---- Replay --------------------------------------------------------------------------------

    @Test
    void ignoredPushCanBeReplayedOnceTheRepositoryIsLinked() throws Exception {
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.INACTIVE));
        Long id = deliverAndProcess("push", push("refs/heads/main", BEFORE, AFTER, "c1"));
        GitWebhookEvent ignored = events.findById(id).orElseThrow();
        assertThat(ignored.getStatus()).isEqualTo(GitWebhookEventStatus.IGNORED);

        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.ACTIVE));
        assertThat(store.replay(id, ignored.getTenantId() + 1, 1L)).isEqualTo(GitWebhookEventStore.ReplayOutcome.NOT_FOUND);
        assertThat(store.replay(id, ignored.getTenantId(), 1L)).isEqualTo(GitWebhookEventStore.ReplayOutcome.QUEUED);
        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.RECEIVED);
        processor.process(id);

        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.PROCESSED);
        assertThat(commits.count()).isEqualTo(1);
        assertThat(store.replay(id, ignored.getTenantId(), 1L)).isEqualTo(GitWebhookEventStore.ReplayOutcome.NOT_REPLAYABLE);
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private GitRepository connection(Long tenantId, long externalId, GitRepositoryStatus status) {
        return GitRepository.builder()
                .tenantId(tenantId).projectId(masterId).installationRef(installationRowId)
                .provider(GitProvider.GITHUB).externalId(externalId).ownerLogin("hcm26-java-team").name("ecommerce")
                .fullName("hcm26-java-team/ecommerce").htmlUrl("https://github.com/hcm26-java-team/ecommerce")
                .visibility("private").defaultBranch("main").status(status)
                .linkedByUserId(1L).linkedAt(LocalDateTime.now()).build();
    }

    private ObjectNode base(long repoId) {
        ObjectNode root = json.createObjectNode();
        ObjectNode repository = root.putObject("repository");
        repository.put("id", repoId);
        repository.put("name", "ecommerce");
        repository.put("full_name", "hcm26-java-team/ecommerce");
        repository.putObject("owner").put("login", "hcm26-java-team");
        root.putObject("installation").put("id", GITHUB_INSTALLATION_ID);
        root.putObject("sender").put("login", "dev-a");
        return root;
    }

    private ObjectNode push(String ref, String before, String after, String... shas) {
        return push(ref, before, after, LINKED_REPO, shas);
    }

    private ObjectNode push(String ref, String before, String after, long repoId, String... shas) {
        ObjectNode root = base(repoId);
        root.put("ref", ref);
        root.put("before", before);
        root.put("after", after);
        root.put("created", ZERO.equals(before));
        root.put("deleted", false);
        root.put("forced", false);
        ArrayNode list = root.putArray("commits");
        for (String sha : shas) list.add(payloadCommit(sha));
        return root;
    }

    private ObjectNode payloadCommit(String sha) {
        ObjectNode commit = json.createObjectNode();
        commit.put("id", sha);
        commit.put("message", "feat: " + sha);
        commit.put("timestamp", "2026-11-17T10:00:00+07:00");
        commit.put("url", "https://github.com/hcm26-java-team/ecommerce/commit/" + sha);
        commit.putObject("author").put("name", "Dev A").put("email", "dev-a@example.com").put("username", "dev-a");
        commit.putObject("committer").put("name", "Dev A").put("email", "dev-a@example.com").put("username", "dev-a");
        commit.putArray("added").add("Cart.java");
        commit.putArray("removed");
        commit.putArray("modified").add("pom.xml");
        return commit;
    }

    /** A push whose payload holds exactly the 2,048 commits GitHub keeps: the rest must come from the API. */
    private ObjectNode truncatedPush(String before) {
        String[] shas = new String[2048];
        for (int i = 0; i < shas.length; i++) shas[i] = "p" + i;
        return push("refs/heads/main", before, AFTER, shas);
    }

    private List<GitHubCommit> apiCommits(String prefix, int from, int to) {
        List<GitHubCommit> list = new ArrayList<>();
        for (int i = from; i < to; i++) list.add(apiCommit(prefix + i));
        return list;
    }

    private static GitHubCommit apiCommit(String sha) {
        var person = new GitHubCommit.Person("Dev A", "dev-a@example.com", "2026-11-17T03:00:00Z");
        return new GitHubCommit(sha, "https://github.com/hcm26-java-team/ecommerce/commit/" + sha,
                new GitHubCommit.GitData("api " + sha, person, person),
                new GitHubCommit.Account("dev-a", 501L), new GitHubCommit.Account("dev-a", 501L),
                List.of(new GitHubCommit.Parent("parent")));
    }

    private ObjectNode pullRequestEvent(String action, int number, String state, boolean merged, String updatedAt) {
        ObjectNode root = base(LINKED_REPO);
        root.put("action", action);
        root.put("number", number);
        ObjectNode pr = root.putObject("pull_request");
        pr.put("id", 70_000L + number);
        pr.put("number", number);
        pr.put("title", "Add cart");
        pr.put("body", "Implements the cart");
        pr.put("state", state);
        pr.put("draft", false);
        pr.put("merged", merged);
        pr.put("html_url", "https://github.com/hcm26-java-team/ecommerce/pull/" + number);
        pr.putObject("user").put("login", "dev-a").put("id", 501L);
        pr.putObject("head").put("ref", "feature/cart").put("sha", "h" + number);
        pr.putObject("base").put("ref", "main");
        pr.put("created_at", "2026-11-17T09:00:00Z");
        pr.put("updated_at", updatedAt);
        if ("closed".equals(state)) pr.put("closed_at", updatedAt);
        if (merged) {
            pr.put("merged_at", updatedAt);
            pr.putObject("merged_by").put("login", "lead-c");
        }
        pr.put("commits", 3);
        pr.put("additions", 120);
        pr.put("deletions", 4);
        pr.put("changed_files", 5);
        return root;
    }

    private ObjectNode reviewEvent(String action, long reviewId, String state, int number, String prUpdatedAt) {
        ObjectNode root = pullRequestEvent("ignored", number, "open", false, prUpdatedAt);
        root.put("action", action);
        ObjectNode pr = (ObjectNode) root.get("pull_request");
        pr.remove(List.of("merged", "commits", "additions", "deletions", "changed_files")); // a review's PR is the short form
        ObjectNode review = root.putObject("review");
        review.put("id", reviewId);
        review.put("state", state);
        review.put("body", "Looks good");
        review.put("commit_id", "h" + number);
        review.put("submitted_at", "2026-11-17T10:00:00Z");
        review.put("html_url", "https://github.com/hcm26-java-team/ecommerce/pull/" + number + "#review-" + reviewId);
        review.putObject("user").put("login", "reviewer-b").put("id", 601L);
        root.putObject("sender").put("login", "reviewer-b");
        return root;
    }

    private Long deliverAndProcess(String event, ObjectNode body) throws Exception {
        Long id = deliver(event, body);
        processor.process(id);
        return id;
    }

    private Long deliver(String event, ObjectNode body) throws Exception {
        String deliveryId = "delivery-" + UUID.randomUUID();
        byte[] bytes = json.writeValueAsString(body).getBytes(StandardCharsets.UTF_8);
        mvc.perform(post("/api/webhooks/github").contentType(MediaType.APPLICATION_JSON).content(bytes)
                        .header("X-GitHub-Event", event)
                        .header("X-GitHub-Delivery", deliveryId)
                        .header("X-Hub-Signature-256", verifier.sign(SECRET, bytes)))
                .andExpect(status().isAccepted());
        return events.findByProviderAndDeliveryId(GitProvider.GITHUB, deliveryId).orElseThrow().getId();
    }

    private void makeDue(Long id) {
        tx.executeWithoutResult(status -> events.findById(id).orElseThrow().setNextAttemptAt(LocalDateTime.now().minusSeconds(1)));
    }

    private void awaitStatus(Long id, GitWebhookEventStatus expected) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 10_000;
        while (System.currentTimeMillis() < deadline) {
            if (events.findById(id).orElseThrow().getStatus() == expected) return;
            Thread.sleep(50);
        }
        assertThat(events.findById(id).orElseThrow().getStatus()).isEqualTo(expected);
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

    /** An {@code @Async} method without an executor name, like the application's other async code. */
    public static class AsyncProbe {
        @Async
        public CompletableFuture<String> threadName() {
            return CompletableFuture.completedFuture(Thread.currentThread().getName());
        }
    }

    @TestConfiguration
    static class AsyncProbeConfig {
        @Bean
        AsyncProbe asyncProbe() {
            return new AsyncProbe();
        }
    }
}
