package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;
import com.example.starter_project_2025.system.git_integration.service.RepositoryInsightsQueryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.concurrent.atomic.AtomicLong;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * WS-GH-02: {@code /repository/insights} and {@code /repository/branches}. Rows are stored
 * directly (relative to the integration clock's "now"); the task link part goes through the
 * real webhook, like the other task link tests.
 */
class RepositoryInsightsIntegrationTest extends AbstractTaskLinkIntegrationTest {

    private static final String BASE = "/api/v1/git-integration/projects/{id}/repository";
    private static final AtomicLong IDS = new AtomicLong(1_000);

    @Autowired @Qualifier("gitIntegrationClock") Clock clock;
    @Autowired RepositoryInsightsQueryService insightsService;

    private ResultActions insights(String token, Long projectId, String range) throws Exception {
        var request = get(BASE + "/insights", projectId).header("Authorization", "Bearer " + token);
        if (range != null) request.param("range", range);
        return mvc.perform(request);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    /** Today at noon: rows relative to it stay on today whatever time the test runs. */
    private LocalDateTime noon() {
        return today().atTime(12, 0);
    }

    private GitCommit storeCommit(LocalDateTime at, String login, String name, String ref) {
        long id = IDS.incrementAndGet();
        return commits.saveAndFlush(GitCommit.builder()
                .tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).project(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, masterId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId)).repoExternalId(REPO)
                .sha("s" + id).message("commit " + id).authorLogin(login).authorName(name)
                .committedAt(at).firstSeenRef(ref).source(GitCommitSource.WEBHOOK_PAYLOAD)
                .ingestedEvent(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent.class, 1L)).ingestedAt(at).parentCount(1).build());
    }

    private GitCommit storeCommit(LocalDateTime at, String login) {
        return storeCommit(at, login, login, "refs/heads/main");
    }

    private GitPullRequest storePullRequest(int number, GitPullRequestState state, boolean draft, String author,
                                            LocalDateTime createdAt, LocalDateTime updatedAt, LocalDateTime mergedAt) {
        return pullRequests.saveAndFlush(GitPullRequest.builder()
                .tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).project(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, masterId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId)).repoExternalId(REPO)
                .externalId(90_000L + number).number(number).title("PR " + number).state(state).draft(draft)
                .authorLogin(author).headRef("feat/" + number).baseRef("main")
                .githubCreatedAt(createdAt).githubUpdatedAt(updatedAt).mergedAt(mergedAt)
                .closedAt(mergedAt).build());
    }

    private void storeReview(GitPullRequest pr, String reviewer, GitReviewState state, LocalDateTime at) {
        reviews.saveAndFlush(GitPullRequestReview.builder()
                .tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).project(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, masterId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId)).pullRequest(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitPullRequest.class, pr.getId()))
                .externalId(IDS.incrementAndGet()).reviewerLogin(reviewer).state(state)
                .submittedAt(at).sourceUpdatedAt(at).sourceActionRank(1).build());
    }

    @Test
    void accessIsCheckedAndAnUnlinkedProjectReturnsEmptyDays() throws Exception {
        String outsider = tx.execute(status -> token(user(tenants.findById(tenantId).orElseThrow(),
                role("WSGH-NONE-", "SPRINT_BACKLOG_READ"))));
        insights(outsider, masterId, null).andExpect(status().isForbidden());
        // Another tenant's project is not revealed at all (same as /activity).
        insights(otherTenantToken, masterId, null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_NOT_FOUND"));

        insights(managerToken, otherProjectId, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repositoryId").doesNotExist())
                .andExpect(jsonPath("$.range").value("30d"))
                .andExpect(jsonPath("$.daily", hasSize(30)))
                .andExpect(jsonPath("$.summary.commits").value(0))
                .andExpect(jsonPath("$.contributors", hasSize(0)))
                .andExpect(jsonPath("$.pullRequests.attention", hasSize(0)));
        mvc.perform(get(BASE + "/branches", otherProjectId).header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void rangeSetsThePeriodAndAnUnknownRangeIsRejected() throws Exception {
        insights(readerToken, masterId, "7d")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repositoryId").value(connectionId))
                .andExpect(jsonPath("$.daily", hasSize(7)))
                .andExpect(jsonPath("$.from").value(today().minusDays(6).toString()))
                .andExpect(jsonPath("$.to").value(today().toString()))
                .andExpect(jsonPath("$.daily[0].date").value(today().minusDays(6).toString()));
        insights(readerToken, masterId, "90d").andExpect(jsonPath("$.daily", hasSize(90)));
        insights(readerToken, masterId, "1y")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_INSIGHTS_RANGE_INVALID"));
    }

    @Test
    void commitsFallOnTheirCalendarDayAndAModuleReadsItsMaster() throws Exception {
        LocalDate today = today();
        storeCommit(today.atStartOfDay(), "dev-a");
        storeCommit(today.atTime(LocalTime.of(23, 59, 59)), "dev-a");
        storeCommit(today.minusDays(1).atTime(12, 0), "dev-b");
        storeCommit(today.minusDays(7).atTime(23, 59, 59), "dev-b"); // the day before a 7-day period

        insights(readerToken, moduleId, "7d")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repositoryId").value(connectionId))
                .andExpect(jsonPath("$.daily[6].commits").value(2))
                .andExpect(jsonPath("$.daily[5].commits").value(1))
                .andExpect(jsonPath("$.daily[0].commits").value(0))
                .andExpect(jsonPath("$.summary.commits").value(3))
                .andExpect(jsonPath("$.summary.activeDays").value(2))
                .andExpect(jsonPath("$.truncated").value(false));
    }

    @Test
    void contributorsGroupLoginsIgnoreBotsAndCountPullRequestsAndReviews() throws Exception {
        LocalDateTime now = noon();
        storeCommit(now.minusHours(3), "Dev-A", "Dev A", "refs/heads/main");
        storeCommit(now.minusHours(1), "dev-a", "Dev A", "refs/heads/main");
        storeCommit(now.minusHours(2), null, "Offline Dev", "refs/heads/main");
        storeCommit(now.minusHours(2), "dependabot[bot]", "dependabot", "refs/heads/main");
        GitPullRequest pr = storePullRequest(1, GitPullRequestState.OPEN, false, "dev-a", now.minusHours(5), now.minusHours(5), null);
        storeReview(pr, "reviewer-x", GitReviewState.COMMENTED, now.minusMinutes(30));
        storeReview(pr, "reviewer-y", GitReviewState.PENDING, now.minusMinutes(20));

        insights(readerToken, masterId, "7d")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.daily[6].commits").value(4)) // the bot's commit is still activity
                .andExpect(jsonPath("$.summary.contributors").value(3))
                .andExpect(jsonPath("$.contributors", hasSize(3)))
                .andExpect(jsonPath("$.contributors[0].login").value("dev-a"))
                .andExpect(jsonPath("$.contributors[0].name").value("Dev A"))
                .andExpect(jsonPath("$.contributors[0].matched").value(true))
                .andExpect(jsonPath("$.contributors[0].commits").value(2))
                .andExpect(jsonPath("$.contributors[0].pullRequestsOpened").value(1))
                .andExpect(jsonPath("$.contributors[1].login").doesNotExist())
                .andExpect(jsonPath("$.contributors[1].name").value("Offline Dev"))
                .andExpect(jsonPath("$.contributors[1].matched").value(false))
                .andExpect(jsonPath("$.contributors[2].login").value("reviewer-x"))
                .andExpect(jsonPath("$.contributors[2].reviews").value(1))
                .andExpect(jsonPath("$.otherContributors").value(0));
    }

    @Test
    void onlyTheTopTenContributorsAreListed() throws Exception {
        LocalDateTime now = noon();
        for (int person = 0; person < 12; person++) {
            for (int i = 0; i <= person; i++) storeCommit(now.minusMinutes(person * 20L + i), "dev-" + person);
        }
        insights(readerToken, masterId, "7d")
                .andExpect(jsonPath("$.contributors", hasSize(10)))
                .andExpect(jsonPath("$.contributors[0].login").value("dev-11"))
                .andExpect(jsonPath("$.contributors[0].commits").value(12))
                .andExpect(jsonPath("$.summary.contributors").value(12))
                .andExpect(jsonPath("$.otherContributors").value(2));
    }

    @Test
    void openPullRequestsAreSortedByAttentionAndMergeTimeIsAMedian() throws Exception {
        LocalDateTime now = noon();
        storePullRequest(1, GitPullRequestState.MERGED, false, "dev-a", now.minusHours(7), now.minusHours(1), now.minusHours(1));
        storePullRequest(2, GitPullRequestState.MERGED, false, "dev-a", now.minusHours(12), now.minusHours(2), now.minusHours(2));
        storePullRequest(3, GitPullRequestState.MERGED, false, "dev-b", now.minusHours(43), now.minusHours(3), now.minusHours(3));
        storePullRequest(10, GitPullRequestState.OPEN, false, "dev-a", now.minusDays(1), now.minusHours(1), null);
        GitPullRequest changes = storePullRequest(11, GitPullRequestState.OPEN, false, "dev-b", now.minusDays(1), now.minusMinutes(30), null);
        storeReview(changes, "reviewer-x", GitReviewState.CHANGES_REQUESTED, now.minusMinutes(30));
        storePullRequest(12, GitPullRequestState.OPEN, true, "dev-b", now.minusDays(6), now.minusDays(5), null);
        GitPullRequest approved = storePullRequest(13, GitPullRequestState.OPEN, false, "dev-a", now.minusDays(1), now.minusMinutes(10), null);
        storeReview(approved, "reviewer-x", GitReviewState.APPROVED, now.minusMinutes(10));
        storePullRequest(14, GitPullRequestState.OPEN, true, "dev-a", now.minusHours(2), now.minusHours(2), null);

        insights(readerToken, masterId, "7d")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.pullRequestsMerged").value(3))
                .andExpect(jsonPath("$.summary.medianHoursToMerge").value(10.0))
                .andExpect(jsonPath("$.daily[6].pullRequestsMerged").value(3))
                .andExpect(jsonPath("$.pullRequests.open").value(5))
                .andExpect(jsonPath("$.pullRequests.changesRequested").value(1))
                .andExpect(jsonPath("$.pullRequests.awaitingReview").value(1))
                .andExpect(jsonPath("$.pullRequests.stale").value(1))
                .andExpect(jsonPath("$.pullRequests.staleDays").value(3))
                .andExpect(jsonPath("$.pullRequests.attention", hasSize(3)))
                .andExpect(jsonPath("$.pullRequests.attention[0].reason").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.pullRequests.attention[0].pullRequest.number").value(11))
                .andExpect(jsonPath("$.pullRequests.attention[0].pullRequest.reviewSummary.changesRequested").value(1))
                .andExpect(jsonPath("$.pullRequests.attention[1].reason").value("AWAITING_REVIEW"))
                .andExpect(jsonPath("$.pullRequests.attention[1].pullRequest.number").value(10))
                .andExpect(jsonPath("$.pullRequests.attention[2].reason").value("STALE"))
                .andExpect(jsonPath("$.pullRequests.attention[2].pullRequest.number").value(12));
    }

    @Test
    void noMergedPullRequestMeansNoMedian() throws Exception {
        insights(readerToken, masterId, "7d")
                .andExpect(jsonPath("$.summary.medianHoursToMerge").doesNotExist())
                .andExpect(jsonPath("$.pullRequests.open").value(0));
    }

    @Test
    void branchesDropTheRefPrefixAndSkipTags() throws Exception {
        LocalDateTime now = noon();
        storeCommit(now.minusHours(5), "dev-a", "Dev A", "refs/heads/main");
        storeCommit(now.minusHours(1), "dev-a", "Dev A", "refs/heads/feat/cart");
        storeCommit(now.minusHours(2), "dev-a", "Dev A", "refs/heads/feat/cart");
        storeCommit(now.minusHours(3), "dev-a", "Dev A", "refs/tags/v1.0");
        storeCommit(now.minusDays(40), "dev-a", "Dev A", "refs/heads/feat/old"); // outside 30 days, still a branch

        insights(readerToken, masterId, "30d")
                .andExpect(jsonPath("$.branches", hasSize(2)))
                .andExpect(jsonPath("$.branches[0].name").value("feat/cart"))
                .andExpect(jsonPath("$.branches[0].commits").value(2))
                .andExpect(jsonPath("$.branches[1].name").value("main"));

        mvc.perform(get(BASE + "/branches", masterId).header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].name").value("feat/cart"))
                .andExpect(jsonPath("$[2].name").value("feat/old"));
        mvc.perform(get(BASE + "/branches", masterId).param("q", " FEAT ").param("limit", "1")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("feat/cart"))
                .andExpect(jsonPath("$[0].commits").value(2));
        mvc.perform(get(BASE + "/branches", masterId).param("limit", "0").header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void aPeriodWithMoreCommitsThanTheCapIsMarkedTruncated() throws Exception {
        LocalDateTime now = noon();
        for (int i = 0; i < 3; i++) storeCommit(now.minusMinutes(i), "dev-a");
        Object previous = ReflectionTestUtils.getField(insightsService, "maxCommits");
        ReflectionTestUtils.setField(insightsService, "maxCommits", 2);
        try {
            insights(readerToken, masterId, "7d")
                    .andExpect(jsonPath("$.truncated").value(true))
                    .andExpect(jsonPath("$.summary.commits").value(2));
        } finally {
            ReflectionTestUtils.setField(insightsService, "maxCommits", previous);
        }
    }

    @Test
    void aLinkedTaskRefNamesTheProjectOfItsTask() throws Exception {
        push(commit("c-module", moduleTask.getTaskKey() + " add cart page", "2026-11-17T09:00:00Z"),
                commit("c-master", masterTask.getTaskKey() + " landing page", "2026-11-17T10:00:00Z"));

        mvc.perform(get(BASE + "/commits", masterId).header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].sha").value("c-master"))
                .andExpect(jsonPath("$.items[0].taskRefs[0].status").value("LINKED"))
                .andExpect(jsonPath("$.items[0].taskRefs[0].itemProjectId").value(masterId))
                .andExpect(jsonPath("$.items[1].sha").value("c-module"))
                .andExpect(jsonPath("$.items[1].taskRefs[0].itemProjectId").value(moduleId));
    }
}
