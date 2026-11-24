package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.GitHubGraphQlClient;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubActor;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranch;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubHistoryCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestNode;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewNode;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewPage;
import com.example.starter_project_2025.system.git_integration.sync.GitRepositorySyncRunner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-SY-02 acceptance criteria: pull requests and reviews through the real sync runner (GitHub mocked). */
class PullRequestSyncIntegrationTest extends AbstractTaskLinkIntegrationTest {

    @DynamicPropertySource
    static void sync(DynamicPropertyRegistry registry) {
        registry.add("app.github.sync-max-pages-per-run", () -> "2");
        registry.add("app.github.sync-reconcile-enabled", () -> "false");
    }

    private static final LocalDateTime T = LocalDateTime.now().minusDays(2).truncatedTo(ChronoUnit.SECONDS);

    @Autowired GitRepositorySyncRunner runner;
    @Autowired InstallationTokenProvider installationTokens;

    @MockBean GitHubGraphQlClient graphql;

    @BeforeEach
    void gitHub() {
        installationTokens.invalidate(GITHUB_INSTALLATION_ID);
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenReturn(new GitHubInstallationToken("ghs_meta", Instant.now().plusSeconds(3600)));
        when(github.createContentsToken(GITHUB_INSTALLATION_ID))
                .thenReturn(new GitHubInstallationToken("ghs_contents", Instant.now().plusSeconds(3600)));
        when(github.getRepository(anyString(), eq(REPO))).thenReturn(Optional.of(new GitHubRepository(REPO, "webshop",
                "hcm26-java-team/webshop", new GitHubRepository.Owner("hcm26-java-team"),
                "https://github.com/hcm26-java-team/webshop", true, "private", "main", false, false)));
        when(github.listBranches(anyString(), anyString(), anyString(), anyInt())).thenReturn(List.of(new GitHubBranch("main", true)));
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt()))
                .thenReturn(new GitHubCommitHistoryPage(true, false, "main", "h", List.of(), false, null, 0, null));
    }

    // ---- AC01 / AC03 / AC04 ----------------------------------------------------------------------------

    @Test
    void ac01InitialSyncImportsEveryPullRequestClassifiedByState() throws Exception {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.pullRequests(anyString(), eq("hcm26-java-team"), eq("webshop"), isNull(), eq(50), eq(50)))
                .thenReturn(page(List.of(
                        pr(3, "OPEN", false, T.plusHours(3), List.of()),
                        pr(2, "MERGED", true, T.plusHours(2), List.of())), true, "c1"));
        when(graphql.pullRequests(anyString(), anyString(), anyString(), eq("c1"), anyInt(), anyInt()))
                .thenReturn(page(List.of(pr(1, "CLOSED", false, T.plusHours(1), List.of())), false, "c2"));

        runner.run(jobId); // commit page + first pull request page: the run's budget (2) is used
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        runner.run(jobId);

        GitSyncJob job = jobs.findById(jobId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(job.getPhase()).isEqualTo(GitSyncPhase.DONE);
        assertThat(pullRequests.countByRepository_Id(connectionId)).isEqualTo(3);
        GitPullRequest open = pr(3);
        assertThat(open.getState()).isEqualTo(GitPullRequestState.OPEN);
        assertThat(open.getTitle()).isEqualTo("PR 3");
        assertThat(open.getHeadRef()).isEqualTo("feature/3");
        assertThat(open.getBaseRef()).isEqualTo("main");
        assertThat(open.getAuthorLogin()).isEqualTo("dev-gh");
        assertThat(open.getLastSyncJobId()).isEqualTo(jobId);
        assertThat(open.getLastEventId()).isNull();
        // AC03: merged, with its merge date.
        assertThat(pr(2).getState()).isEqualTo(GitPullRequestState.MERGED);
        assertThat(pr(2).getMergedAt()).isNotNull();
        // AC04: closed without merging is not merged.
        assertThat(pr(1).getState()).isEqualTo(GitPullRequestState.CLOSED);
        assertThat(pr(1).getMergedAt()).isNull();
        assertThat(connections.findById(connectionId).orElseThrow().getPullRequestsSyncedAt()).isEqualTo(job.getCreatedAt());

        mvc.perform(get(repositoryUrl()).header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.repository.pullRequestCount").value(3))
                .andExpect(jsonPath("$.repository.pullRequestsSyncedAt").isNotEmpty())
                .andExpect(jsonPath("$.latestSync.progress.pullRequests.inserted").value(3))
                .andExpect(jsonPath("$.latestSync.progress.pullRequests.pages").value(2));
        mvc.perform(get(repositoryUrl() + "/pull-requests").param("state", "MERGED").header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    // ---- AC02 ------------------------------------------------------------------------------------------

    @Test
    void ac02AChangedPullRequestIsUpdatedNotDuplicated() {
        stored(7, "Old title", GitPullRequestState.OPEN, T, null);
        Long jobId = pullRequestJob(null);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(page(List.of(pr(7, "CLOSED", false, T.plusHours(1), List.of())), false, null));

        runner.run(jobId);

        assertThat(pullRequests.countByRepository_Id(connectionId)).isEqualTo(1);
        GitPullRequest updated = pr(7);
        assertThat(updated.getTitle()).isEqualTo("PR 7");
        assertThat(updated.getState()).isEqualTo(GitPullRequestState.CLOSED);
        assertThat(updated.getLastSyncJobId()).isEqualTo(jobId);
        assertThat(jobs.findById(jobId).orElseThrow().getStatsJson()).contains("\"pullRequestsUpdated\":1");
    }

    @Test
    void theSameVersionOnlyFillsWhatTheWebhookLackedAndNeverOverwrites() {
        stored(8, "Webhook title", GitPullRequestState.OPEN, T, null); // a review payload: no counters
        Long jobId = pullRequestJob(null);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(page(List.of(pr(8, "OPEN", false, T, List.of())), false, null));

        runner.run(jobId);

        GitPullRequest row = pr(8);
        assertThat(row.getTitle()).isEqualTo("Webhook title");
        assertThat(row.getCommitsCount()).isEqualTo(4);
        assertThat(row.getAdditions()).isEqualTo(10);
        assertThat(row.getLastSyncJobId()).isNull(); // the current version is still the webhook's
        assertThat(jobs.findById(jobId).orElseThrow().getStatsJson())
                .contains("\"pullRequestsUnchanged\":1").contains("\"pullRequestsEnriched\":1");
    }

    // ---- AC05 ------------------------------------------------------------------------------------------

    @Test
    void ac05ARepositoryWithoutPullRequestsSucceedsWithAnEmptyList() throws Exception {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(page(List.of(), false, null));

        runner.run(jobId);

        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        mvc.perform(get(repositoryUrl()).header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$.repository.pullRequestCount").value(0))
                .andExpect(jsonPath("$.latestSync.stats.pullRequestsEmpty").value(true));
        mvc.perform(get(repositoryUrl() + "/pull-requests").header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    // ---- AC06 ------------------------------------------------------------------------------------------

    @Test
    void ac06SubmittedReviewsAreStoredAndPendingOnesAreNot() {
        Long jobId = pullRequestJob(null);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(page(List.of(pr(4, "OPEN", false, T, List.of(
                        review(401, "APPROVED", "lead-gh", 11L),
                        review(402, "CHANGES_REQUESTED", "qa-gh", 12L),
                        review(403, "COMMENTED", "copilot[bot]", 13L),
                        review(404, "PENDING", "draft-gh", 14L)))), false, null));

        runner.run(jobId);

        assertThat(reviews.findAll()).hasSize(3);
        GitPullRequestReview approved = reviews.findByRepositoryAndReviewId(connectionId, 401L).stream().findFirst().orElseThrow();
        assertThat(approved.getState()).isEqualTo(GitReviewState.APPROVED);
        assertThat(approved.getReviewerLogin()).isEqualTo("lead-gh");
        assertThat(approved.getReviewerGithubId()).isEqualTo(11L);
        assertThat(approved.getSubmittedAt()).isEqualTo(T.minusHours(1));
        assertThat(approved.getPullRequestId()).isEqualTo(pr(4).getId());
        assertThat(approved.getLastSyncJobId()).isEqualTo(jobId);
        assertThat(reviews.findByRepositoryAndReviewId(connectionId, 402L).stream().findFirst().orElseThrow().getState())
                .isEqualTo(GitReviewState.CHANGES_REQUESTED);
        assertThat(reviews.findByRepositoryAndReviewId(connectionId, 404L).stream().findFirst()).isEmpty();
        assertThat(jobs.findById(jobId).orElseThrow().getStatsJson()).contains("\"reviewsInserted\":3");
    }

    @Test
    void aPullRequestWithMoreReviewsThanAPageGetsThemAll() {
        Long jobId = pullRequestJob(null);
        GitHubPullRequestNode many = new GitHubPullRequestNode("PR_node_5", 5005L, 5, "PR 5", null, "u", "OPEN", false, false,
                iso(T.minusDays(1)), iso(T), null, null, "feature/5", "sha5", "main", 1, 1, 1, 1, null, null,
                new GitHubActor("dev-gh", 7L), List.of(review(501, "COMMENTED", "a", 1L)), true, "r1");
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(page(List.of(many), false, null));
        when(graphql.pullRequestReviews(anyString(), eq("PR_node_5"), eq("r1"), eq(100)))
                .thenReturn(new GitHubReviewPage(List.of(review(502, "APPROVED", "b", 2L), review(503, "APPROVED", "c", 3L)),
                        false, null, null));

        runner.run(jobId);

        assertThat(reviews.findAll()).extracting(GitPullRequestReview::getExternalId).containsExactlyInAnyOrder(501L, 502L, 503L);
    }

    @Test
    void aReviewKeepsTheWebhookVersionOfTheSameMomentAndTakesANewerOne() {
        GitPullRequest row = stored(6, "PR 6", GitPullRequestState.OPEN, T, 1L);
        reviews.saveAndFlush(GitPullRequestReview.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).project(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, masterId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId))
                .pullRequest(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitPullRequest.class, row.getId())).externalId(601L).reviewerLogin("lead-gh").state(GitReviewState.COMMENTED)
                .submittedAt(T.minusHours(1)).sourceUpdatedAt(T).sourceActionRank(1).lastEvent(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent.class, 1L)).build());
        Long first = pullRequestJob(null);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(page(List.of(pr(6, "OPEN", false, T, List.of(review(601, "DISMISSED", "lead-gh", 11L)))), false, null));
        runner.run(first);
        assertThat(reviews.findByRepositoryAndReviewId(connectionId, 601L).stream().findFirst().orElseThrow().getState())
                .isEqualTo(GitReviewState.COMMENTED); // same version: the webhook's stays

        // A dismissal the webhook missed: the pull request moved on, so the sync's version is newer.
        Long second = pullRequestJob(null);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(page(List.of(pr(6, "OPEN", false, T.plusHours(1), List.of(review(601, "DISMISSED", "lead-gh", 11L)))), false, null));
        runner.run(second);
        assertThat(reviews.findByRepositoryAndReviewId(connectionId, 601L).stream().findFirst().orElseThrow().getState())
                .isEqualTo(GitReviewState.DISMISSED);
    }

    // ---- Incremental, errors, rate limit ------------------------------------------------------------------

    @Test
    void anIncrementalSyncStillReadsOlderPullRequestsSoReviewChangesAreNotMissed() {
        Long jobId = pullRequestJob(T);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(page(List.of(
                        pr(12, "OPEN", false, T.plusHours(1), List.of()),
                        pr(11, "OPEN", false, T.minusHours(1), List.of()),
                        pr(10, "OPEN", false, T.minusHours(2), List.of())), false, "c1"));

        runner.run(jobId);

        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(pullRequests.findAll()).extracting(GitPullRequest::getNumber).containsExactly(12, 11, 10);
        verify(graphql, times(1)).pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt());
    }

    @Test
    void aLaterSyncReadsDownToADayBeforeTheLastCompleteRead() {
        LocalDateTime read = T.plusDays(1);
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setPullRequestsSyncedAt(read));
        Long jobId = queue(GitSyncJobType.MANUAL);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt())).thenReturn(page(List.of(), false, null));

        runner.run(jobId);

        assertThat(jobs.findById(jobId).orElseThrow().getPrSince()).isEqualTo(read.minusDays(1));
    }

    @Test
    void anErrorOnALaterPageEndsPartialAndTheResumeDoesNotReadTheCommitsAgain() throws Exception {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt()))
                .thenReturn(new GitHubCommitHistoryPage(true, false, "main", "h", List.of(historyCommit("k1")), false, "k", 1, null));
        when(graphql.pullRequests(anyString(), anyString(), anyString(), isNull(), anyInt(), anyInt()))
                .thenReturn(page(List.of(pr(21, "OPEN", false, T, List.of())), true, "c1"));
        when(graphql.pullRequests(anyString(), anyString(), anyString(), eq("c1"), anyInt(), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "pull requests", 502));

        runner.run(jobId); // commit page + first pull request page, then yields
        for (int attempt = 0; attempt < 3; attempt++) {
            makeDue(jobId);
            runner.run(jobId);
        }
        GitSyncJob partial = jobs.findById(jobId).orElseThrow();
        assertThat(partial.getStatus()).isEqualTo(GitSyncJobStatus.PARTIAL);
        assertThat(partial.getErrorCode()).isEqualTo("PULL_REQUESTS_UNAVAILABLE");
        assertThat(partial.getPrCursor()).isEqualTo("c1");
        mvc.perform(get(repositoryUrl()).header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.latestSync.resumable").value(true));

        mvc.perform(post(repositoryUrl() + "/sync").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isAccepted());
        // SY-06: the resume is a new job continuing at the pull request cursor; the PARTIAL one is kept.
        GitSyncJob resumed = jobs.findFirstByRepository_IdOrderByIdDesc(connectionId).orElseThrow();
        assertThat(resumed.getResumedFromJobId()).isEqualTo(jobId);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), eq("c1"), anyInt(), anyInt()))
                .thenReturn(page(List.of(pr(20, "MERGED", true, T.minusHours(1), List.of())), false, "c2"));
        runner.run(resumed.getId());

        assertThat(jobs.findById(resumed.getId()).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.PARTIAL);
        assertThat(pullRequests.countByRepository_Id(connectionId)).isEqualTo(2);
        verify(graphql, times(1)).commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt());
    }

    @Test
    void anAppWithoutPullRequestPermissionKeepsTheCommitsAndSaysWhy() {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt()))
                .thenReturn(new GitHubCommitHistoryPage(true, false, "main", "h", List.of(historyCommit("k2")), false, "k", 1, null));
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.REJECTED, "pull requests", 403));

        runner.run(jobId);

        GitSyncJob job = jobs.findById(jobId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.PARTIAL);
        assertThat(job.getErrorCode()).isEqualTo("PULL_REQUESTS_FORBIDDEN");
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(1);
    }

    @Test
    void theRateLimitPausesThePullRequestStep() {
        Long jobId = pullRequestJob(null);
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(new GitHubPullRequestPage(true, false, List.of(pr(30, "OPEN", false, T, List.of())), true, "c1", 9,
                        new GitHubCommitHistoryPage.RateLimit(30, Instant.now().plusSeconds(900), 26)));

        runner.run(jobId);

        GitSyncJob paused = jobs.findById(jobId).orElseThrow();
        assertThat(paused.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(paused.getErrorCode()).isEqualTo("RATE_LIMITED");
        assertThat(paused.getAttemptCount()).isZero();
        assertThat(paused.getPrCursor()).isEqualTo("c1");
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private Long queue(GitSyncJobType type) {
        return jobs.saveAndFlush(GitSyncJob.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId)).type(type)
                .status(GitSyncJobStatus.PENDING).maxAttempts(3).nextRunAt(LocalDateTime.now().minusSeconds(1))
                .dedupeKey(type == GitSyncJobType.INITIAL ? "INITIAL:" + connectionId : null).build()).getId();
    }

    /** A job whose commit step is done: the run goes straight to the pull request step with this window. */
    private Long pullRequestJob(LocalDateTime since) {
        return jobs.saveAndFlush(GitSyncJob.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId)).type(GitSyncJobType.MANUAL)
                .status(GitSyncJobStatus.PENDING).maxAttempts(3).nextRunAt(LocalDateTime.now().minusSeconds(1))
                .phase(GitSyncPhase.PULL_REQUESTS).prSince(since).build()).getId();
    }

    private void makeDue(Long jobId) {
        tx.executeWithoutResult(status -> jobs.findById(jobId).orElseThrow().setNextRunAt(LocalDateTime.now().minusSeconds(1)));
    }

    private String repositoryUrl() {
        return "/api/v1/git-integration/projects/" + masterId + "/repository";
    }

    private GitPullRequest pr(int number) {
        return pullRequests.findByRepository_IdAndNumber(connectionId, number).orElseThrow();
    }

    private GitPullRequest stored(int number, String title, GitPullRequestState state, LocalDateTime updatedAt, Long eventId) {
        return pullRequests.saveAndFlush(GitPullRequest.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).project(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, masterId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId))
                .repoExternalId(REPO).externalId(9000L + number).number(number).title(title).state(state).draft(false)
                .authorLogin("dev-gh").headRef("feature/" + number).baseRef("main")
                .githubCreatedAt(updatedAt.minusDays(1)).githubUpdatedAt(updatedAt).lastEvent(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent.class, eventId)).build());
    }

    private static String iso(LocalDateTime time) {
        return time.atZone(ZoneId.systemDefault()).toOffsetDateTime().toString();
    }

    private static GitHubPullRequestPage page(List<GitHubPullRequestNode> nodes, boolean hasNext, String endCursor) {
        return new GitHubPullRequestPage(true, false, new ArrayList<>(nodes), hasNext, endCursor, nodes.size(),
                new GitHubCommitHistoryPage.RateLimit(4900, Instant.now().plusSeconds(3600), 26));
    }

    private static GitHubPullRequestNode pr(int number, String state, boolean merged, LocalDateTime updatedAt, List<GitHubReviewNode> reviews) {
        return new GitHubPullRequestNode("PR_node_" + number, 9000L + number, number, "PR " + number, "Body " + number,
                "https://github.com/hcm26-java-team/webshop/pull/" + number, state, merged, false,
                iso(updatedAt.minusDays(1)), iso(updatedAt), "OPEN".equals(state) ? null : iso(updatedAt),
                merged ? iso(updatedAt) : null, "feature/" + number, "sha" + number, "main", 10, 2, 3, 4,
                merged ? "merge" + number : null, merged ? "lead-gh" : null, new GitHubActor("dev-gh", 7L),
                reviews, false, null);
    }

    private static GitHubReviewNode review(long id, String state, String login, Long githubId) {
        return new GitHubReviewNode(id, state, "Review " + id, "https://github.com/r/" + id, iso(T.minusHours(1)), iso(T),
                "sha", new GitHubActor(login, githubId));
    }

    private static GitHubHistoryCommit historyCommit(String sha) {
        return new GitHubHistoryCommit(sha, "commit " + sha, "u", iso(T), iso(T), 1,
                new GitHubHistoryCommit.Person("Dev", "dev@x.test", "dev-gh", 7L), null);
    }
}
