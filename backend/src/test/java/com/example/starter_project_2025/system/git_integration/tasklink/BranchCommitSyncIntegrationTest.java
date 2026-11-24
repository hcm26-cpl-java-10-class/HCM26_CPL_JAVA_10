package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.GitTestReferences;
import com.example.starter_project_2025.system.git_integration.domain.GitBranch;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.GitHubGraphQlClient;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranch;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranchPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubComparePage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubHistoryCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBranchRepository;
import com.example.starter_project_2025.system.git_integration.sync.GitRepositorySyncRunner;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobQueue;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

/** US-SY-07: commits of the branches other than the default branch, through the real sync runner (GitHub mocked). */
class BranchCommitSyncIntegrationTest extends AbstractTaskLinkIntegrationTest {

    private static final String OWNER = "hcm26-java-team";
    private static final String NAME = "webshop";

    /** Small caps so the branch limit, the page cap and the yield are exercised with a few mocked pages. */
    @DynamicPropertySource
    static void sync(DynamicPropertyRegistry registry) {
        registry.add("app.github.sync-max-pages-per-run", () -> "6");
        registry.add("app.github.sync-reconcile-enabled", () -> "false");
        registry.add("app.github.sync-max-branches", () -> "3");
        registry.add("app.github.sync-branch-max-pages", () -> "2");
        registry.add("app.github.sync-branch-exclude", () -> "dependabot/**");
    }

    @Autowired GitRepositorySyncRunner runner;
    @Autowired GitSyncJobQueue queue;
    @Autowired GitBranchRepository branchRows;
    @Autowired InstallationTokenProvider installationTokens;

    @MockBean GitHubGraphQlClient graphql;

    @BeforeEach
    void gitHub() {
        branchRows.deleteAll();
        installationTokens.invalidate(GITHUB_INSTALLATION_ID);
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenReturn(new GitHubInstallationToken("ghs_meta", Instant.now().plusSeconds(3600)));
        when(github.createContentsToken(GITHUB_INSTALLATION_ID))
                .thenReturn(new GitHubInstallationToken("ghs_contents", Instant.now().plusSeconds(3600)));
        when(github.getRepository(anyString(), eq(REPO))).thenReturn(Optional.of(new GitHubRepository(REPO, NAME,
                OWNER + "/" + NAME, new GitHubRepository.Owner(OWNER),
                "https://github.com/" + OWNER + "/" + NAME, true, "private", "main", false, false)));
        when(github.listBranches(anyString(), anyString(), anyString(), anyInt())).thenReturn(List.of(new GitHubBranch("main", true)));
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt()))
                .thenReturn(new GitHubCommitHistoryPage(true, false, "main", "m1", List.of(gh("m1")), false, "h1", 1, quota(4900)));
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(new GitHubPullRequestPage(true, false, List.of(), false, null, 0, null));
    }

    @Test
    void importsOnlyTheCommitsOfABranchThatAreNotOnTheDefaultBranch() throws Exception {
        listing(branch("main", "m1", 1), branch("feature/cart", "f2", 2));
        when(graphql.compare(anyString(), eq(OWNER), eq(NAME), eq("main"), eq("feature/cart"), isNull(), eq(100)))
                .thenReturn(compare(List.of(gh("f1"), gh("f2")), false, "x1"));
        Long jobId = queue(GitSyncJobType.INITIAL);

        runner.run(jobId);

        GitSyncJob job = jobs.findById(jobId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(job.getPhase()).isEqualTo(GitSyncPhase.DONE);
        assertThat(job.getStatsJson()).contains("\"branchesSynced\":1").contains("\"branchCommitsInserted\":2")
                .contains("\"branchesListed\":2");
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(3);
        assertThat(commit("m1").getFirstSeenRef()).isEqualTo("refs/heads/main");
        GitCommit f1 = commit("f1");
        assertThat(f1.getFirstSeenRef()).isEqualTo("refs/heads/feature/cart");
        assertThat(f1.getSource()).isEqualTo(GitCommitSource.GRAPHQL_HISTORY);
        assertThat(f1.getIngestedSyncJobId()).isEqualTo(jobId);
        GitBranch cart = branch("feature/cart");
        assertThat(cart.getSyncedHeadOid()).isEqualTo("f2");
        assertThat(cart.getAheadBy()).isEqualTo(2);
        assertThat(cart.isTruncated()).isFalse();
        assertThat(branch("main").isDefault()).isTrue();
        // The default branch itself is never compared.
        verify(graphql, never()).compare(anyString(), anyString(), anyString(), anyString(), eq("main"), any(), anyInt());

        mvc.perform(get("/api/v1/git-integration/projects/" + masterId + "/repository").header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$.latestSync.progress.branches.done").value(1))
                .andExpect(jsonPath("$.latestSync.progress.branches.inserted").value(2));
        mvc.perform(get("/api/v1/git-integration/projects/" + masterId + "/repository/branches").header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$[?(@.name == 'feature/cart')].commits").value(2))
                .andExpect(jsonPath("$[?(@.name == 'feature/cart')].aheadBy").value(2))
                .andExpect(jsonPath("$[?(@.name == 'main')].isDefault").value(true));
    }

    @Test
    void aBranchWhoseHeadDidNotChangeIsNotReadAgainAndAChangedOneIs() {
        listing(branch("main", "m1", 1), branch("feature/a", "a1", 2), branch("feature/b", "b1", 3));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("feature/a"), any(), anyInt()))
                .thenReturn(compare(List.of(gh("a1")), false, "x"));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("feature/b"), any(), anyInt()))
                .thenReturn(compare(List.of(gh("b1")), false, "x"));
        runner.run(queue(GitSyncJobType.INITIAL));

        listing(branch("main", "m1", 1), branch("feature/a", "a1", 2), branch("feature/b", "b2", 4));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("feature/b"), any(), anyInt()))
                .thenReturn(compare(List.of(gh("b2"), gh("b1")), false, "x"));
        Long second = queue(GitSyncJobType.SCHEDULED);
        runner.run(second);

        verify(graphql, times(1)).compare(anyString(), anyString(), anyString(), anyString(), eq("feature/a"), any(), anyInt());
        verify(graphql, times(2)).compare(anyString(), anyString(), anyString(), anyString(), eq("feature/b"), any(), anyInt());
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(4);
        assertThat(jobs.findById(second).orElseThrow().getStatsJson())
                .contains("\"branchesChanged\":1").contains("\"branchesSkipped\":1").contains("\"branchCommitsInserted\":1");
        assertThat(branch("feature/b").getSyncedHeadOid()).isEqualTo("b2");
    }

    @Test
    void aCommitAlreadyStoredKeepsTheBranchItWasFirstSeenOn() {
        commits.saveAndFlush(GitCommit.builder().tenant(GitTestReferences.ref(Tenant.class, tenantId))
                .project(GitTestReferences.ref(Project.class, masterId)).repository(GitTestReferences.ref(GitRepository.class, connectionId))
                .repoExternalId(REPO).sha("f1").message("from push").authorName("Dev").authorEmail("dev@x.test")
                .committedAt(LocalDateTime.now().minusDays(1)).firstSeenRef("refs/heads/feature/old-name")
                .source(GitCommitSource.WEBHOOK_PAYLOAD).ingestedEvent(GitTestReferences.ref(GitWebhookEvent.class, 1L))
                .ingestedAt(LocalDateTime.now()).bot(false).build());
        listing(branch("main", "m1", 1), branch("feature/cart", "f1", 2));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("feature/cart"), any(), anyInt()))
                .thenReturn(compare(List.of(gh("f1")), false, "x"));

        runner.run(queue(GitSyncJobType.INITIAL));

        GitCommit stored = commit("f1");
        assertThat(stored.getFirstSeenRef()).isEqualTo("refs/heads/feature/old-name");
        assertThat(stored.getMessage()).isEqualTo("from push");
        assertThat(stored.getParentCount()).isEqualTo(1); // completed by the sync
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(2);
    }

    @Test
    void branchesGoneFromGitHubAreMarkedDeletedAndKeepTheirCommits() throws Exception {
        listing(branch("main", "m1", 1), branch("feature/a", "a1", 2), branch("feature/gone", "g1", 3));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("feature/a"), any(), anyInt()))
                .thenReturn(compare(List.of(gh("a1")), false, "x"));
        // Deleted between the listing and its compare: skipped, the job still succeeds.
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("feature/gone"), any(), anyInt()))
                .thenReturn(GitHubComparePage.refMissing(quota(4900)));
        Long first = queue(GitSyncJobType.INITIAL);
        runner.run(first);
        assertThat(jobs.findById(first).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(branch("feature/gone").getDeletedAt()).isNotNull();

        listing(branch("main", "m1", 1));
        Long second = queue(GitSyncJobType.SCHEDULED);
        runner.run(second);

        assertThat(branch("feature/a").getDeletedAt()).isNotNull();
        assertThat(commit("a1").getFirstSeenRef()).isEqualTo("refs/heads/feature/a");
        assertThat(jobs.findById(second).orElseThrow().getStatsJson()).contains("\"branchesDeleted\":1");
        mvc.perform(get("/api/v1/git-integration/projects/" + masterId + "/repository/branches").header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$[?(@.name == 'feature/a')].deleted").value(true))
                .andExpect(jsonPath("$[?(@.name == 'feature/gone')]").isEmpty()); // no commit of its own
    }

    @Test
    void readsAtMostTheConfiguredBranchesLatestFirstAndSkipsExcludedOnes() {
        listing(branch("main", "m1", 1), branch("dependabot/npm/x", "d1", 9), branch("old", "o1", 2),
                branch("recent-1", "r1", 5), branch("recent-2", "r2", 6), branch("recent-3", "r3", 7));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyInt()))
                .thenReturn(compare(List.of(), false, null));

        runner.run(queue(GitSyncJobType.INITIAL));

        verify(graphql, never()).compare(anyString(), anyString(), anyString(), anyString(), eq("old"), any(), anyInt());
        verify(graphql, never()).compare(anyString(), anyString(), anyString(), anyString(), eq("dependabot/npm/x"), any(), anyInt());
        verify(graphql).compare(anyString(), anyString(), anyString(), anyString(), eq("recent-1"), any(), anyInt());
        verify(graphql).compare(anyString(), anyString(), anyString(), anyString(), eq("recent-3"), any(), anyInt());
    }

    @Test
    void aBranchIsCutAtThePageCapAndReadAgainByTheNextSyncNow() {
        listing(branch("main", "m1", 1), branch("big", "b3", 2));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("big"), isNull(), anyInt()))
                .thenReturn(compare(List.of(gh("b3")), true, "p1"));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("big"), eq("p1"), anyInt()))
                .thenReturn(compare(List.of(gh("b2")), true, "p2"));
        Long jobId = queue(GitSyncJobType.INITIAL);

        runner.run(jobId);

        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        verify(graphql, never()).compare(anyString(), anyString(), anyString(), anyString(), eq("big"), eq("p2"), anyInt());
        GitBranch big = branch("big");
        assertThat(big.isTruncated()).isTrue();
        assertThat(big.getSyncedHeadOid()).isEqualTo("b3");
        assertThat(jobs.findById(jobId).orElseThrow().getStatsJson()).contains("\"branchesPartial\":1");

        tx.executeWithoutResult(status -> jobs.findById(jobId).orElseThrow().setFinishedAt(LocalDateTime.now().minusHours(1)));
        queue.request(connectionId, GitSyncJobType.MANUAL, null, LocalDateTime.now());
        assertThat(branch("big").getSyncedHeadOid()).isNull();
    }

    @Test
    void aFailedBranchPageIsRetriedFromItsCursorWithoutReadingFinishedBranchesAgain() {
        listing(branch("main", "m1", 1), branch("a", "a1", 2), branch("b", "b2", 3));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("a"), any(), anyInt()))
                .thenReturn(compare(List.of(gh("a1")), false, "x"));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("b"), isNull(), anyInt()))
                .thenReturn(compare(List.of(gh("b2")), true, "bp1"));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("b"), eq("bp1"), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "branch commits", 502));
        Long jobId = queue(GitSyncJobType.INITIAL);

        runner.run(jobId);
        GitSyncJob failed = jobs.findById(jobId).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(failed.getErrorCode()).isEqualTo("BRANCHES_UNAVAILABLE");
        assertThat(failed.getPhase()).isEqualTo(GitSyncPhase.BRANCHES);
        assertThat(failed.getBranchName()).isEqualTo("b");
        assertThat(failed.getBranchCursor()).isEqualTo("bp1");

        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("b"), eq("bp1"), anyInt()))
                .thenReturn(compare(List.of(gh("b1")), false, "bp2"));
        makeDue(jobId);
        runner.run(jobId);

        GitSyncJob job = jobs.findById(jobId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        verify(graphql, times(1)).compare(anyString(), anyString(), anyString(), anyString(), eq("a"), any(), anyInt());
        verify(graphql, times(1)).compare(anyString(), anyString(), anyString(), anyString(), eq("b"), isNull(), anyInt());
        verify(graphql, times(1)).branches(anyString(), anyString(), anyString(), any(), anyInt()); // listed once
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(4);
        assertThat(branch("b").getSyncedHeadOid()).isEqualTo("b2");
    }

    @Test
    void aStoppedJobIsPartialAndAResumeContinuesTheBranchItWasReading() {
        listing(branch("main", "m1", 1), branch("b", "b2", 3));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("b"), isNull(), anyInt()))
                .thenReturn(compare(List.of(gh("b2")), true, "bp1"));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("b"), eq("bp1"), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "branch commits", 502));
        Long jobId = queue(GitSyncJobType.INITIAL);
        for (int attempt = 0; attempt < 3; attempt++) {
            makeDue(jobId);
            runner.run(jobId);
        }
        GitSyncJob stopped = jobs.findById(jobId).orElseThrow();
        assertThat(stopped.getStatus()).isEqualTo(GitSyncJobStatus.PARTIAL);
        assertThat(GitSyncJobQueue.resumable(stopped)).isTrue();

        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("b"), eq("bp1"), anyInt()))
                .thenReturn(compare(List.of(gh("b1")), false, "bp2"));
        Long resumed = queue.request(connectionId, GitSyncJobType.MANUAL, null, LocalDateTime.now().minusSeconds(1))
                .orElseThrow().job().getId();
        runner.run(resumed);

        assertThat(jobs.findById(resumed).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        verify(graphql, times(1)).compare(anyString(), anyString(), anyString(), anyString(), eq("b"), isNull(), anyInt());
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(3);
    }

    @Test
    void aLowQuotaPausesTheJobUntilTheResetWithoutUsingAnAttempt() {
        listing(branch("main", "m1", 1), branch("a", "a1", 2), branch("b", "b1", 3));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("a"), any(), anyInt()))
                .thenReturn(new GitHubComparePage(true, true, false, "AHEAD", 1, 0, List.of(gh("a1")), false, "x", quota(10)));
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("b"), any(), anyInt()))
                .thenReturn(compare(List.of(gh("b1")), false, "x"));
        Long jobId = queue(GitSyncJobType.INITIAL);

        runner.run(jobId);

        GitSyncJob paused = jobs.findById(jobId).orElseThrow();
        assertThat(paused.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(paused.getErrorCode()).isEqualTo("RATE_LIMITED");
        assertThat(paused.getAttemptCount()).isZero();
        verify(graphql, never()).compare(anyString(), anyString(), anyString(), anyString(), eq("b"), any(), anyInt());

        makeDue(jobId);
        runner.run(jobId);
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        verify(graphql, times(1)).compare(anyString(), anyString(), anyString(), anyString(), eq("a"), any(), anyInt());
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(3);
    }

    @Test
    void aRunYieldsWhenItsPagesAreUsedAndTheNextRunGoesOn() {
        // Budget 6 per run: commits 1 + listing 1 + a (2) + b (2) = 6, then c is left to the next run.
        listing(branch("main", "m1", 1), branch("a", "a2", 2), branch("b", "b2", 3), branch("c", "c1", 4));
        for (String name : List.of("a", "b")) {
            when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq(name), isNull(), anyInt()))
                    .thenReturn(compare(List.of(gh(name + "2")), true, name + "p1"));
            when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq(name), eq(name + "p1"), anyInt()))
                    .thenReturn(compare(List.of(gh(name + "1")), false, name + "p2"));
        }
        when(graphql.compare(anyString(), anyString(), anyString(), anyString(), eq("c"), any(), anyInt()))
                .thenReturn(compare(List.of(gh("c1")), false, "x"));
        Long jobId = queue(GitSyncJobType.INITIAL);

        runner.run(jobId);
        GitSyncJob yielded = jobs.findById(jobId).orElseThrow();
        assertThat(yielded.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(yielded.getPhase()).isEqualTo(GitSyncPhase.BRANCHES);
        verify(graphql, never()).compare(anyString(), anyString(), anyString(), anyString(), eq("c"), any(), anyInt());

        runner.run(jobId);
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(6);
        assertThat(jobs.findById(jobId).orElseThrow().getStatsJson()).contains("\"branchesSynced\":3");
    }

    @Test
    void aPushKeepsTheBranchHeadAndMarksItImportedOnlyWhenItContinuesAnImportedHead() throws Exception {
        // A branch never imported: the push stores its commits but older ones are left to the next sync.
        deliverAndProcess("push", pushOn("feature/x", "0".repeat(40), commitNode("x1")));
        GitBranch x = branch("feature/x");
        assertThat(x.getHeadOid()).isEqualTo("x1");
        assertThat(x.getSyncedHeadOid()).isNull();

        tx.executeWithoutResult(status -> branchRows.findById(x.getId()).orElseThrow().setSyncedHeadOid("x1"));
        deliverAndProcess("push", pushOn("feature/x", "x1", commitNode("x2")));
        assertThat(branch("feature/x").getSyncedHeadOid()).isEqualTo("x2");

        ObjectNode deleted = pushOn("feature/x", "x2", commitNode("x2"));
        deleted.put("deleted", true);
        deleted.put("after", "0".repeat(40));
        deleted.putArray("commits");
        deliverAndProcess("push", deleted);
        assertThat(branch("feature/x").getDeletedAt()).isNotNull();
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private void listing(GitHubBranchPage.Branch... branches) {
        when(graphql.branches(anyString(), eq(OWNER), eq(NAME), isNull(), eq(100)))
                .thenReturn(new GitHubBranchPage(true, false, "main", List.of(branches), false, "end", branches.length, quota(4900)));
    }

    private static GitHubBranchPage.Branch branch(String name, String head, int day) {
        return new GitHubBranchPage.Branch(name, head, "2026-11-%02dT08:00:00Z".formatted(day));
    }

    private GitBranch branch(String name) {
        return branchRows.findByRepository_IdAndNameKey(connectionId, GitBranch.keyOf(name)).orElseThrow();
    }

    private static GitHubComparePage compare(List<GitHubHistoryCommit> commits, boolean hasNext, String endCursor) {
        return new GitHubComparePage(true, true, false, "AHEAD", commits.size(), 0, commits, hasNext, endCursor, quota(4900));
    }

    private static GitHubCommitHistoryPage.RateLimit quota(int remaining) {
        return new GitHubCommitHistoryPage.RateLimit(remaining, Instant.now().plusSeconds(3600), 1);
    }

    private static GitHubHistoryCommit gh(String sha) {
        return new GitHubHistoryCommit(sha, "commit " + sha, "https://github.com/" + OWNER + "/" + NAME + "/commit/" + sha,
                "2026-11-20T08:00:00+07:00", "2026-11-20T08:00:00+07:00", 1,
                new GitHubHistoryCommit.Person("Author " + sha, sha + "@git.test", "dev-gh", 7L),
                new GitHubHistoryCommit.Person("GitHub", "noreply@github.com", null, null));
    }

    private ObjectNode commitNode(String sha) {
        return commit(sha, "work " + sha, "2026-11-21T08:00:00+07:00");
    }

    private ObjectNode pushOn(String branch, String before, ObjectNode head) {
        ObjectNode root = base();
        root.put("ref", "refs/heads/" + branch);
        root.put("before", before);
        root.put("after", head.get("id").asText());
        root.put("created", before.chars().allMatch(c -> c == '0'));
        root.put("deleted", false);
        root.put("forced", false);
        root.set("head_commit", head.deepCopy());
        root.putArray("commits").add(head);
        return root;
    }

    private Long queue(GitSyncJobType type) {
        return jobs.saveAndFlush(GitSyncJob.builder().tenant(GitTestReferences.ref(Tenant.class, tenantId))
                .repository(GitTestReferences.ref(GitRepository.class, connectionId)).type(type)
                .status(GitSyncJobStatus.PENDING).maxAttempts(3).nextRunAt(LocalDateTime.now().minusSeconds(1))
                .dedupeKey(type == GitSyncJobType.INITIAL ? "INITIAL:" + connectionId : null).build()).getId();
    }

    private void makeDue(Long jobId) {
        tx.executeWithoutResult(status -> jobs.findById(jobId).orElseThrow().setNextRunAt(LocalDateTime.now().minusSeconds(1)));
    }
}
