package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.GitHubGraphQlClient;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranch;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubHistoryCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.sync.GitCommitReconcileJob;
import com.example.starter_project_2025.system.git_integration.sync.GitRepositorySyncRunner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-SY-01 acceptance criteria: commit history import through the real sync runner (GitHub mocked). */
class CommitHistorySyncIntegrationTest extends AbstractTaskLinkIntegrationTest {

    /** Small pages per run so the yield (D3) is exercised without hundreds of mocked pages. */
    @DynamicPropertySource
    static void sync(DynamicPropertyRegistry registry) {
        registry.add("app.github.sync-max-pages-per-run", () -> "2");
        registry.add("app.github.sync-reconcile-enabled", () -> "false");
    }

    @Autowired GitRepositorySyncRunner runner;
    @Autowired GitCommitReconcileJob reconcile;
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
        // SY-02: the pull request step (covered by PullRequestSyncIntegrationTest) finds none.
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(new GitHubPullRequestPage(true, false, List.of(), false, null, 0, null));
    }

    // ---- AC01 · Initial sync -------------------------------------------------------------------------

    @Test
    void ac01InitialSyncImportsTheWholeHistoryPageByPage() throws Exception {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), eq("hcm26-java-team"), eq("webshop"), isNull(), isNull(), eq(100)))
                .thenReturn(page(List.of(commit("s3", 1, "dev-gh", 7L), commit("s2", 2, "dev-gh", 7L)), true, "c1"));
        when(graphql.commitHistory(anyString(), anyString(), anyString(), isNull(), eq("c1"), anyInt()))
                .thenReturn(page(List.of(commit("s1", 1, "dependabot[bot]", 9L)), false, "c2"));

        runner.run(jobId);
        // The two commit pages used the run's budget (2): the pull request step is left to the next run.
        GitSyncJob handedOver = jobs.findById(jobId).orElseThrow();
        assertThat(handedOver.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(handedOver.getPhase()).isEqualTo(GitSyncPhase.PULL_REQUESTS);
        assertThat(connections.findById(connectionId).orElseThrow().getCommitHistorySyncedAt()).isNotNull();
        runner.run(jobId);

        GitSyncJob job = jobs.findById(jobId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(job.getPhase()).isEqualTo(GitSyncPhase.DONE);
        assertThat(job.getPagesDone()).isEqualTo(2);
        assertThat(job.getStatsJson()).contains("\"commitsInserted\":3").contains("\"branches\":1");
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(3);
        GitCommit merge = commit("s2");
        assertThat(merge.getRepositoryId()).isEqualTo(connectionId);
        assertThat(merge.getSource()).isEqualTo(GitCommitSource.GRAPHQL_HISTORY);
        assertThat(merge.getIngestedSyncJobId()).isEqualTo(jobId);
        assertThat(merge.getIngestedEventId()).isNull();
        assertThat(merge.getFirstSeenRef()).isEqualTo("refs/heads/main");
        assertThat(merge.getMergeCommit()).isTrue();
        assertThat(merge.getBot()).isFalse();
        assertThat(merge.getAuthorGithubId()).isEqualTo(7L);
        assertThat(merge.getAuthorEmail()).isEqualTo("s2@git.test"); // the Git identity is kept apart
        assertThat(commit("s1").getBot()).isTrue();
        assertThat(commit("s1").getMergeCommit()).isFalse();
        // The history counts as imported up to the job's creation.
        GitRepository connection = connections.findById(connectionId).orElseThrow();
        assertThat(connection.getCommitHistorySyncedAt()).isEqualTo(job.getCreatedAt());
        assertThat(connection.getLastSyncedAt()).isNotNull();

        mvc.perform(get(repositoryUrl()).header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.repository.commitCount").value(3))
                .andExpect(jsonPath("$.repository.historySyncedAt").isNotEmpty())
                .andExpect(jsonPath("$.latestSync.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.latestSync.phase").value("DONE"))
                .andExpect(jsonPath("$.latestSync.progress.inserted").value(3))
                .andExpect(jsonPath("$.latestSync.resumable").value(false))
                .andExpect(jsonPath("$.canSync").value(true));
    }

    // ---- AC02 · New commits only ---------------------------------------------------------------------

    @Test
    void ac02ALaterSyncReadsFromADayBeforeTheLastImportAndAddsOnlyNewCommits() throws Exception {
        LocalDateTime imported = LocalDateTime.now().minusDays(3).truncatedTo(ChronoUnit.SECONDS);
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setCommitHistorySyncedAt(imported));
        Long first = queue(GitSyncJobType.MANUAL);
        OffsetDateTime since = imported.minusDays(1).atZone(ZoneId.systemDefault()).toOffsetDateTime();
        when(graphql.commitHistory(anyString(), anyString(), anyString(), eq(since), isNull(), anyInt()))
                .thenReturn(page(List.of(commit("old", 1, "dev-gh", 7L)), false, "c1"));
        runner.run(first);
        String message = commit("old").getMessage();

        tx.executeWithoutResult(status -> jobs.findById(first).orElseThrow().setFinishedAt(LocalDateTime.now().minusHours(1)));
        Long second = queue(GitSyncJobType.MANUAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), isNull(), anyInt()))
                .thenReturn(page(List.of(commit("new", 1, "dev-gh", 7L), commit("old", 1, "dev-gh", 7L)), false, "c1"));
        runner.run(second);

        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(2);
        assertThat(commit("old").getMessage()).isEqualTo(message);
        assertThat(commit("old").getIngestedSyncJobId()).isEqualTo(first);
        assertThat(jobs.findById(second).orElseThrow().getStatsJson())
                .contains("\"commitsInserted\":1").contains("\"commitsExisting\":1");
        // The mark moved forward to the newer job.
        assertThat(connections.findById(connectionId).orElseThrow().getCommitHistorySyncedAt())
                .isEqualTo(jobs.findById(second).orElseThrow().getCreatedAt());
    }

    @Test
    void anInitialSyncReadsTheWholeHistoryEvenAfterAnEarlierImport() {
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setCommitHistorySyncedAt(LocalDateTime.now()));
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt())).thenReturn(page(List.of(), false, null));

        runner.run(jobId);

        verify(graphql).commitHistory(anyString(), anyString(), anyString(), isNull(), isNull(), anyInt());
    }

    // ---- AC03 · Empty repository ---------------------------------------------------------------------

    @Test
    void ac03AnEmptyRepositorySucceedsAndSaysSo() throws Exception {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt()))
                .thenReturn(new GitHubCommitHistoryPage(true, false, null, null, List.of(), false, null, 0, null));

        runner.run(jobId);

        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        mvc.perform(get(repositoryUrl()).header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$.repository.commitCount").value(0))
                .andExpect(jsonPath("$.latestSync.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.latestSync.stats.emptyRepository").value(true));
    }

    // ---- AC04 · Duplicates ---------------------------------------------------------------------------

    @Test
    void ac04ACommitAlreadyStoredIsNotDuplicatedButGetsWhatThePushLacked() {
        // As a push webhook stored it: no GitHub id, no parents, seen on a feature branch.
        commits.saveAndFlush(GitCommit.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).project(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, masterId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId))
                .repoExternalId(REPO).sha("dup").message("from push").authorName("Dev").authorEmail("dev@x.test")
                .authorLogin("dev-gh").committedAt(LocalDateTime.now().minusDays(1)).firstSeenRef("refs/heads/feature")
                .source(GitCommitSource.WEBHOOK_PAYLOAD).ingestedEvent(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent.class, 1L)).ingestedAt(LocalDateTime.now()).bot(false).build());
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt()))
                .thenReturn(page(List.of(commit("dup", 3, "dev-gh", 7L)), false, "c1"));

        runner.run(jobId);
        tx.executeWithoutResult(status -> jobs.findById(jobId).orElseThrow().setFinishedAt(LocalDateTime.now().minusHours(1)));
        Long again = queue(GitSyncJobType.MANUAL);
        runner.run(again);

        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(1);
        GitCommit stored = commit("dup");
        assertThat(stored.getMessage()).isEqualTo("from push"); // never overwritten
        assertThat(stored.getFirstSeenRef()).isEqualTo("refs/heads/feature");
        assertThat(stored.getIngestedEventId()).isEqualTo(1L);
        assertThat(stored.getAuthorGithubId()).isEqualTo(7L); // filled
        assertThat(stored.getParentCount()).isEqualTo(3);
        assertThat(stored.getMergeCommit()).isTrue();
        assertThat(jobs.findById(jobId).orElseThrow().getStatsJson())
                .contains("\"commitsInserted\":0").contains("\"commitsEnriched\":1");
        assertThat(jobs.findById(again).orElseThrow().getStatsJson())
                .contains("\"commitsInserted\":0").contains("\"commitsEnriched\":0");
    }

    // ---- AC05 · GitHub errors ------------------------------------------------------------------------

    @Test
    void ac05AnErrorMidwayKeepsTheCursorEndsPartialAndResumesWhereItStopped() throws Exception {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), isNull(), anyInt()))
                .thenReturn(page(List.of(commit("p1", 1, "dev-gh", 7L)), true, "c1"));
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), eq("c1"), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "commit history", 502));

        runner.run(jobId);
        GitSyncJob retrying = jobs.findById(jobId).orElseThrow();
        assertThat(retrying.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(retrying.getErrorCode()).isEqualTo("HISTORY_UNAVAILABLE");
        assertThat(retrying.getCommitCursor()).isEqualTo("c1");
        assertThat(retrying.getPagesDone()).isEqualTo(1);

        makeDue(jobId);
        runner.run(jobId);
        makeDue(jobId);
        runner.run(jobId);
        GitSyncJob partial = jobs.findById(jobId).orElseThrow();
        assertThat(partial.getStatus()).isEqualTo(GitSyncJobStatus.PARTIAL); // never SUCCEEDED with pages left
        assertThat(partial.getCommitCursor()).isEqualTo("c1");
        assertThat(connections.findById(connectionId).orElseThrow().getCommitHistorySyncedAt()).isNull();
        mvc.perform(get(repositoryUrl()).header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.latestSync.status").value("PARTIAL"))
                .andExpect(jsonPath("$.latestSync.errorCode").value("HISTORY_UNAVAILABLE"))
                .andExpect(jsonPath("$.latestSync.resumable").value(true))
                .andExpect(jsonPath("$.latestSync.progress.inserted").value(1));

        // "Resume sync" queues a new job that continues from the cursor (SY-06: the PARTIAL one stays in the history).
        mvc.perform(post(repositoryUrl() + "/sync").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("PENDING"));
        GitSyncJob resumed = jobs.findFirstByRepository_IdOrderByIdDesc(connectionId).orElseThrow();
        assertThat(resumed.getId()).isNotEqualTo(jobId);
        assertThat(resumed.getResumedFromJobId()).isEqualTo(jobId);
        assertThat(resumed.getCommitCursor()).isEqualTo("c1");
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), eq("c1"), anyInt()))
                .thenReturn(page(List.of(commit("p2", 1, "dev-gh", 7L)), false, "c2"));
        runner.run(resumed.getId());

        GitSyncJob done = jobs.findById(resumed.getId()).orElseThrow();
        assertThat(done.getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.PARTIAL);
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(2);
        // The first page was read once (before the failure), never again after the resume.
        verify(graphql).commitHistory(anyString(), anyString(), anyString(), any(), isNull(), anyInt());
    }

    @Test
    void ac05AnErrorBeforeAnyPageIsStoredEndsFailed() {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "commit history", 503));

        runner.run(jobId);
        makeDue(jobId);
        runner.run(jobId);
        makeDue(jobId);
        runner.run(jobId);

        GitSyncJob failed = jobs.findById(jobId).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(failed.getErrorCode()).isEqualTo("HISTORY_UNAVAILABLE");
        assertThat(failed.getCommitCursor()).isNull();
    }

    @Test
    void ac05TheRateLimitPausesUntilTheResetWithoutUsingAnAttempt() throws Exception {
        Long jobId = queue(GitSyncJobType.INITIAL);
        Instant reset = Instant.now().plusSeconds(900);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), isNull(), anyInt()))
                .thenReturn(new GitHubCommitHistoryPage(true, false, "main", "head", List.of(commit("r1", 1, "dev-gh", 7L)),
                        true, "c1", 5, new GitHubCommitHistoryPage.RateLimit(20, reset, 1)));

        runner.run(jobId);

        GitSyncJob paused = jobs.findById(jobId).orElseThrow();
        assertThat(paused.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(paused.getErrorCode()).isEqualTo("RATE_LIMITED");
        assertThat(paused.getAttemptCount()).isZero();
        assertThat(paused.getCommitCursor()).isEqualTo("c1");
        assertThat(paused.getNextRunAt()).isAfter(LocalDateTime.now().plusSeconds(800));
        mvc.perform(get(repositoryUrl()).header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.latestSync.pausedUntil").isNotEmpty());

        // A hard rate limit from GitHub is a pause too.
        makeDue(jobId);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), eq("c1"), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.RATE_LIMITED, "commit history", 200, 300L));
        runner.run(jobId);
        assertThat(jobs.findById(jobId).orElseThrow().getAttemptCount()).isZero();
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
    }

    // ---- Long histories, rewritten branches, lost access -----------------------------------------------

    @Test
    void aRunYieldsAfterItsShareOfPagesAndTheNextRunContinues() {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), isNull(), anyInt()))
                .thenReturn(page(List.of(commit("y1", 1, "d", 1L)), true, "c1"));
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), eq("c1"), anyInt()))
                .thenReturn(page(List.of(commit("y2", 1, "d", 1L)), true, "c2"));
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), eq("c2"), anyInt()))
                .thenReturn(page(List.of(commit("y3", 1, "d", 1L)), false, "c3"));

        runner.run(jobId);
        GitSyncJob yielded = jobs.findById(jobId).orElseThrow();
        assertThat(yielded.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(yielded.getAttemptCount()).isZero();
        assertThat(yielded.getErrorCode()).isNull();
        assertThat(yielded.getPhase()).isEqualTo(GitSyncPhase.COMMITS);
        assertThat(yielded.getCommitCursor()).isEqualTo("c2");

        tx.executeWithoutResult(status -> jobs.findById(jobId).orElseThrow().setNextRunAt(LocalDateTime.now().minusSeconds(1)));
        runner.run(jobId);
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(3);
        verify(github).listBranches(anyString(), anyString(), anyString(), anyInt()); // metadata only once per job
    }

    @Test
    void aRejectedCursorReadsTheWindowAgainWithoutDuplicates() {
        Long jobId = queue(GitSyncJobType.MANUAL);
        tx.executeWithoutResult(status -> {
            GitSyncJob job = jobs.findById(jobId).orElseThrow();
            job.setPhase(GitSyncPhase.COMMITS);
            job.setCommitCursor("stale");
            job.setPagesDone(1);
        });
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), eq("stale"), anyInt()))
                .thenReturn(GitHubCommitHistoryPage.invalidCursor(null));
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), isNull(), anyInt()))
                .thenReturn(page(List.of(commit("w1", 1, "d", 1L)), false, "c1"));

        runner.run(jobId);

        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(1);
        verify(github, never()).listBranches(anyString(), anyString(), anyString(), anyInt()); // resumed in the commit step
    }

    @Test
    void losingAccessDuringTheHistoryMarksTheRepositoryInError() {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt()))
                .thenReturn(GitHubCommitHistoryPage.notFound(null));

        runner.run(jobId);

        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(jobs.findById(jobId).orElseThrow().getErrorCode()).isEqualTo("REPOSITORY_NOT_ACCESSIBLE");
        // GI-05: an API failure is ERROR (not confirmed as revoked); the repository stays the project's.
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ERROR);
        assertThat(connections.findById(connectionId).orElseThrow().getStatusReason()).isEqualTo("REPOSITORY_NOT_ACCESSIBLE");
    }

    @Test
    void anAppWithoutContentsPermissionFailsWithAClearReason() {
        Long jobId = queue(GitSyncJobType.INITIAL);
        when(github.createContentsToken(GITHUB_INSTALLATION_ID))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.REJECTED, "create installation token", 422));

        runner.run(jobId);

        GitSyncJob failed = jobs.findById(jobId).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(failed.getErrorCode()).isEqualTo("HISTORY_FORBIDDEN");
    }

    // ---- Sync now and reconcile ------------------------------------------------------------------------

    @Test
    void syncNowQueuesOneJobAndRepeatedClicksQueueNothing() throws Exception {
        String body = mvc.perform(post(repositoryUrl() + "/sync").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.type").value("MANUAL"))
                .andReturn().getResponse().getContentAsString();
        long jobId = json.readTree(body).get("id").asLong();
        mvc.perform(post(repositoryUrl() + "/sync").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(jobId));

        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt())).thenReturn(page(List.of(), false, null));
        runner.run(jobId);
        // Just succeeded: "Sync now" returns that sync (cooldown) instead of queuing another one.
        mvc.perform(post(repositoryUrl() + "/sync").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(jobId))
                .andExpect(jsonPath("$.status").value("SUCCEEDED"));
        assertThat(jobs.count()).isEqualTo(1);

        mvc.perform(post(repositoryUrl() + "/sync").header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void theReconcileQueuesActiveRepositoriesOnceAndSkipsTheOthers() {
        assertThat(reconcile.reconcile()).isEqualTo(1);
        GitSyncJob job = jobs.findFirstByRepository_IdOrderByIdDesc(connectionId).orElseThrow();
        assertThat(job.getType()).isEqualTo(GitSyncJobType.SCHEDULED);
        assertThat(job.getRequestedByUserId()).isNull();
        // Still waiting: nothing new.
        assertThat(reconcile.reconcile()).isZero();
        assertThat(jobs.count()).isEqualTo(1);

        tx.executeWithoutResult(status -> {
            jobs.deleteAll();
            connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.DISCONNECTED);
        });
        assertThat(reconcile.reconcile()).isZero(); // only ACTIVE repositories
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private Long queue(GitSyncJobType type) {
        return jobs.saveAndFlush(GitSyncJob.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId)).type(type)
                .status(GitSyncJobStatus.PENDING).maxAttempts(3).nextRunAt(LocalDateTime.now().minusSeconds(1))
                .dedupeKey(type == GitSyncJobType.INITIAL ? "INITIAL:" + connectionId : null).build()).getId();
    }

    private void makeDue(Long jobId) {
        tx.executeWithoutResult(status -> jobs.findById(jobId).orElseThrow().setNextRunAt(LocalDateTime.now().minusSeconds(1)));
    }

    private String repositoryUrl() {
        return "/api/v1/git-integration/projects/" + masterId + "/repository";
    }

    private static GitHubCommitHistoryPage page(List<GitHubHistoryCommit> commits, boolean hasNext, String endCursor) {
        return new GitHubCommitHistoryPage(true, false, "main", "head", commits, hasNext, endCursor, commits.size(),
                new GitHubCommitHistoryPage.RateLimit(4900, Instant.now().plusSeconds(3600), 1));
    }

    private static GitHubHistoryCommit commit(String sha, int parents, String login, Long githubId) {
        return new GitHubHistoryCommit(sha, "commit " + sha, "https://github.com/hcm26-java-team/webshop/commit/" + sha,
                "2026-11-20T08:00:00+07:00", "2026-11-20T08:00:00+07:00", parents,
                new GitHubHistoryCommit.Person("Author " + sha, sha + "@git.test", login, githubId),
                new GitHubHistoryCommit.Person("GitHub", "noreply@github.com", null, null));
    }
}
