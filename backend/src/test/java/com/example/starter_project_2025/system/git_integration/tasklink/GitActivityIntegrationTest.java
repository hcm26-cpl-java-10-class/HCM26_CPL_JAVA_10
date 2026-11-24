package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.*;
import com.example.starter_project_2025.system.git_integration.ingestion.GitReviewReconciler;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionService;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.contributor.GitContributorMappingChangedEvent;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRule;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import com.example.starter_project_2025.system.project.developmentinsights.integration.GitActivityIntegration;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitDevelopmentRuleRepository;
import com.example.starter_project_2025.system.project.developmentinsights.service.*;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.context.TestPropertySource;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Canonical webhook/Task mapping -> durable projection -> B APIs and exports, on isolated H2. */
@TestPropertySource(properties = {"app.git-activity.projection.enabled=true", "app.git-activity.projection.poller-enabled=false",
        "app.github.pull-request-reconcile-enabled=true"})
class GitActivityIntegrationTest extends AbstractTaskLinkIntegrationTest {
    @Autowired GitActivityIntegration integration;
    @Autowired com.example.starter_project_2025.system.project.developmentinsights.integration.GitActivityProjector projector;
    @Autowired GitDevelopmentRuleRepository rules;
    @Autowired GitReviewReconciler reviewReconciler;
    @Autowired GitIngestionService ingestion;
    @Autowired com.example.starter_project_2025.system.git_integration.ingestion.GitHubPayloadMapper mapper;
    @Autowired InstallationTokenProvider installationTokens;
    @Autowired ApplicationEventPublisher publisher;
    @Autowired com.example.starter_project_2025.system.git_integration.sync.GitSyncJobStore syncStore;
    @Autowired com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository activityRepositories;
    @Autowired com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository activityCommits;
    @Autowired com.example.starter_project_2025.system.project.developmentinsights.repository.GitContributorRepository activityContributors;
    @Autowired com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository activityPrs;
    @Autowired com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository activityLinks;
    @Autowired com.example.starter_project_2025.system.git_integration.repository.GitContributorRepository contributorSources;
    @MockBean GitActivityScopeService scopes;
    @MockBean GitDevelopmentRuleService ruleManager;
    private String activityToken;
    private Long actorId;

    @Override @BeforeEach
    void fixture() {
        for (String table : List.of("git_validation_run_result", "git_validation_run", "git_activity_change", "commit_validation_task_reference", "commit_validation_result",
                "task_git_link", "pull_request_review", "git_commit", "pull_request", "git_repository", "git_contributor")) {
            jdbc.update("delete from " + table);
        }
        super.fixture();
        tx.executeWithoutResult(status -> {
            User actor = user(tenants.findById(tenantId).orElseThrow(), roles.findByName("ADMIN").orElseThrow());
            actorId = actor.getId();
            activityToken = token(actor);
            var root = projects.getReferenceById(masterId);
            rules.save(GitDevelopmentRule.configure(root, GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1, true,
                    "feat,fix", false, "(?i)\\bFA-\\d+\\b", actor, Instant.now()));
            rules.save(GitDevelopmentRule.configure(root, GitDevelopmentRuleType.TASK_ID, 1, true,
                    "feat,fix", false, "(?i)\\bFA-\\d+\\b", actor, Instant.now()));
        });
        when(ruleManager.canManage(301L)).thenReturn(true);
        scope(301L, Set.of(masterId, moduleId), true);
        scope(302L, Set.of(moduleId), false);
        scope(303L, Set.of(masterId, moduleId), false);
        when(scopes.require(399L)).thenThrow(new org.springframework.security.access.AccessDeniedException("Workspace denied"));
    }

    private void scope(Long id, Set<Long> projects, boolean root) {
        Workspace workspace = mock(Workspace.class);
        when(workspace.getTaskKeyPrefix()).thenReturn("FA");
        when(workspace.getProject()).thenReturn(this.projects.findById(masterId).orElseThrow());
        when(scopes.require(id)).thenReturn(new GitActivityScope(workspace, masterId, projects, root, Set.of(), Map.of(), true));
    }
    private long activityRepo() { return activityRepositories.findBySourceRepository_Id(connectionId).orElseThrow().getId(); }
    private void refresh() {
        jdbc.update("update git_activity_change set next_attempt_at = timestamp with time zone '1970-01-01 00:00:00Z' where processed_at is null");
        int processed = integration.processPending();
        if (processed == 0) tx.executeWithoutResult(status -> projector.refresh(connectionId));
        assertThat(processed).isPositive();
    }

    @Test void commitsFlowIntoTaskDetailsAnalyticsComplianceAndExportWithoutDuplicates() throws Exception {
        push(commit("integration-a", "feat: " + moduleTask.getTaskKey() + " TASK-" + moduleTask.getId(), "2026-11-17T10:00:00Z"));
        refresh();
        long commitId = activityCommits.findFirstByRepository_IdAndSha(activityRepo(), "integration-a").orElseThrow().getId();
        assertThat(activityLinks.findAllByCommit_IdOrderByTask_IdAsc(commitId)).hasSize(1);
        mvc.perform(get("/api/workspaces/301/git-activity/commits").header("Authorization", "Bearer " + activityToken)
                .param("taskId", moduleTask.getId().toString()).param("search", "integration-a").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].committedAt").value("2026-11-17T10:00:00Z"));
        mvc.perform(get("/api/workspaces/302/git-activity/commits").header("Authorization", "Bearer " + activityToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/workspaces/303/git-activity/commits").header("Authorization", "Bearer " + activityToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/workspaces/301/git-activity/rules/compliance").header("Authorization", "Bearer " + activityToken))
                .andExpect(status().isOk());
        mvc.perform(get("/api/workspaces/301/git-activity/reports/export/project").header("Authorization", "Bearer " + activityToken).param("format", "EXCEL"))
                .andExpect(status().isOk()).andExpect(header().string("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        push(commit("integration-a", "feat: " + moduleTask.getTaskKey(), "2026-11-17T10:00:00Z"));
        integration.request(connectionId);
        refresh();
        assertThat(activityCommits.countByRepository_Id(activityRepo())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from commit_validation_result where commit_id = ?", Integer.class, commitId)).isEqualTo(2);
        mvc.perform(post("/api/workspaces/301/git-activity/rules/commits/{id}/validate", commitId).header("Authorization", "Bearer " + activityToken).header("Idempotency-Key", "same-request"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/workspaces/301/git-activity/rules/commits/{id}/validate", commitId).header("Authorization", "Bearer " + activityToken).header("Idempotency-Key", "same-request"))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from commit_validation_result where commit_id = ?", Integer.class, commitId)).isEqualTo(4);
        mvc.perform(get("/api/workspaces/302/git-activity/commits").header("Authorization", "Bearer " + activityToken)
                .param("taskId", otherProjectTask.getId().toString())).andExpect(status().isNotFound());
        mvc.perform(get("/api/workspaces/399/git-activity/reports/export/project").header("Authorization", "Bearer " + activityToken).param("format", "EXCEL"))
                .andExpect(status().isForbidden());
    }

    @Test void manualLinksFromBReachAAndSurviveAutoReplayAndContributorRemapping() throws Exception {
        push(commit("manual-a", "fix: no task reference", "2026-11-17T10:00:00Z"));
        refresh();
        long commitId = activityCommits.findFirstByRepository_IdAndSha(activityRepo(), "manual-a").orElseThrow().getId();
        mvc.perform(post("/api/workspaces/301/git-activity/unmapped/links").header("Authorization", "Bearer " + activityToken)
                .contentType("application/json").content("{\"type\":\"COMMIT\",\"activityId\":" + commitId + ",\"taskId\":" + moduleTask.getId() + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.source").value("MANUAL"));
        var canonical = commit("manual-a");
        assertThat(links.findByBacklogItem_IdAndArtifactTypeAndArtifact_Id(moduleTask.getId(), GitArtifactType.COMMIT, canonical.getId()).orElseThrow().getLinkSource()).isEqualTo(BacklogLinkSource.MANUAL);
        linker.linkCommits(List.of(canonical.getId()));
        integration.request(connectionId);
        refresh();
        assertThat(activityLinks.findAllByCommit_IdOrderByTask_IdAsc(commitId)).singleElement()
                .satisfies(link -> assertThat(link.getSource().name()).isEqualTo("MANUAL"));
        tx.executeWithoutResult(status -> {
            var contributor = contributorSources.findByMasterProject_IdOrderByIdAsc(masterId).getFirst();
            contributor.map(users.getReferenceById(actorId), GitContributorMapSource.MANUAL, users.getReferenceById(actorId), java.time.LocalDateTime.now());
            publisher.publishEvent(new GitContributorMappingChangedEvent(tenantId, masterId));
        });
        refresh();
        Long mappedUser = tx.execute(status -> activityCommits.findById(commitId).orElseThrow().getAuthorContributor().getUser().getId());
        assertThat(mappedUser).isEqualTo(actorId);
    }

    @Test void reviewReconciliationUsesCurrentGitHubStateAndRecomputesFirstResponseAfterDismissal() throws Exception {
        deliverAndProcess("pull_request", pullRequest("opened", 72, "feat: " + moduleTask.getTaskKey(), "feature/review", "2026-11-17T09:00:00Z"));
        var pr = pullRequests.findByRepository_IdAndNumber(connectionId, 72).orElseThrow();
        var sourceRepo = tx.execute(status -> { var repo = connections.findById(connectionId).orElseThrow(); repo.getInstallation().getInstallationId(); return repo; });
        installationTokens.invalidate(GITHUB_INSTALLATION_ID);
        when(github.createContentsToken(GITHUB_INSTALLATION_ID)).thenReturn(new GitHubInstallationToken("fixture-token", Instant.now().plusSeconds(3600)));
        var first = json.createObjectNode().put("id", 500L).put("state", "APPROVED").put("submitted_at", "2026-11-17T10:00:00Z");
        first.putObject("user").put("id", 7001L).put("login", "reviewer-one");
        var second = first.deepCopy().put("id", 501L).put("submitted_at", "2026-11-17T12:00:00Z");
        when(github.getPullRequestReview(anyString(), anyString(), anyString(), eq(72), eq(500L))).thenReturn(first);
        when(github.getPullRequestReview(anyString(), anyString(), anyString(), eq(72), eq(501L))).thenReturn(second);
        reviewReconciler.reconcile(sourceRepo, pr.getId(), 500L, "submitted", GitIngestionService.IngestOrigin.webhook(null));
        reviewReconciler.reconcile(sourceRepo, pr.getId(), 501L, "submitted", GitIngestionService.IngestOrigin.webhook(null));
        refresh();
        var activityPr = activityPrs.findFirstByRepository_IdAndExternalId(activityRepo(), pr.getExternalId()).orElseThrow();
        assertThat(activityPr.getFirstReviewAt()).isEqualTo(Instant.parse("2026-11-17T10:00:00Z"));
        when(github.getPullRequestReview(anyString(), anyString(), anyString(), eq(72), eq(500L))).thenReturn(first.deepCopy().put("state", "DISMISSED"));
        reviewReconciler.reconcile(sourceRepo, pr.getId(), 500L, "dismissed", GitIngestionService.IngestOrigin.webhook(null));
        // An older submit delivery reads the current DISMISSED review again.
        reviewReconciler.reconcile(sourceRepo, pr.getId(), 500L, "submitted", GitIngestionService.IngestOrigin.webhook(null));
        refresh();
        assertThat(activityPrs.findById(activityPr.getId()).orElseThrow().getFirstReviewAt()).isEqualTo(Instant.parse("2026-11-17T12:00:00Z"));
        assertThat(reviews.findByPullRequest_IdAndExternalId(pr.getId(), 500L).orElseThrow().getState()).isEqualTo(GitReviewState.DISMISSED);
    }

    @Test void changingRulesDoesNotRevalidateOldCommitsOnMappingOrBootstrapRefresh() throws Exception {
        push(commit("rules-old", "feat: " + moduleTask.getTaskKey(), "2026-11-17T10:00:00Z"));
        tx.executeWithoutResult(status -> rules.save(GitDevelopmentRule.configure(projects.getReferenceById(masterId),
                GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 2, true, "fix", false, "(?i)\\bFA-\\d+\\b",
                users.getReferenceById(actorId), Instant.now())));
        // Even a delayed first projection uses the rule effective at source ingestion.
        refresh();
        long id = activityCommits.findFirstByRepository_IdAndSha(activityRepo(), "rules-old").orElseThrow().getId();
        assertThat(jdbc.queryForObject("select max(rule_version) from commit_validation_result where commit_id=?", Integer.class, id)).isEqualTo(1);
        integration.request(connectionId);
        refresh();
        assertThat(jdbc.queryForObject("select count(*) from commit_validation_result where commit_id=?", Integer.class, id)).isEqualTo(2);
        mvc.perform(post("/api/workspaces/301/git-activity/rules/commits/{id}/validate", id).header("Authorization", "Bearer " + activityToken))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select max(rule_version) from commit_validation_result where commit_id=?", Integer.class, id)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from commit_validation_result where commit_id=?", Integer.class, id)).isEqualTo(4);
    }

    @Test void durableWorkRetriesAfterProjectionFailureAndLeavesCanonicalDataIntact() throws Exception {
        push(commit("retry-a", "feat: " + moduleTask.getTaskKey(), "2026-11-17T10:00:00Z"));
        // Fault injection into a Git-owned rule simulates an unexpected worker failure.
        jdbc.update("update project_dev_rule set task_key_pattern='[' where project_id=? and rule_type='TASK_ID'", masterId);
        jdbc.update("update git_activity_change set next_attempt_at=timestamp with time zone '1970-01-01 00:00:00Z' where processed_at is null");
        assertThat(integration.processPending()).isZero();
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from git_activity_change where processed_at is null and attempts > 0", Integer.class)).isPositive();
        assertThat(activityCommits.count()).isZero();
        jdbc.update("update project_dev_rule set task_key_pattern=? where project_id=? and rule_type='TASK_ID'", "(?i)\\bFA-\\d+\\b", masterId);
        refresh();
        assertThat(activityCommits.countByRepository_Id(activityRepo())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from git_activity_change where processed_at is null", Integer.class)).isZero();
    }

    @Test void batchRevalidationReplayKeepsOriginalResultsAfterNewRulesAndCommits() throws Exception {
        push(commit("batch-first", "feat: " + moduleTask.getTaskKey(), "2026-11-17T10:00:00Z"));
        refresh();
        String original = mvc.perform(post("/api/workspaces/301/git-activity/rules/validate")
                        .header("Authorization", "Bearer " + activityToken).header("Idempotency-Key", "batch-replay"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        tx.executeWithoutResult(status -> rules.save(GitDevelopmentRule.configure(projects.getReferenceById(masterId),
                GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 2, true, "fix", false, "(?i)\\bFA-\\d+\\b",
                users.getReferenceById(actorId), Instant.now())));
        push(commit("batch-second", "feat: " + moduleTask.getTaskKey(), "2026-11-17T11:00:00Z"));
        refresh();
        int before = jdbc.queryForObject("select count(*) from commit_validation_result", Integer.class);
        mvc.perform(post("/api/workspaces/301/git-activity/rules/validate")
                        .header("Authorization", "Bearer " + activityToken).header("Idempotency-Key", "batch-replay"))
                .andExpect(status().isOk()).andExpect(content().json(original));
        assertThat(jdbc.queryForObject("select count(*) from commit_validation_result", Integer.class)).isEqualTo(before);
        long commitId = activityCommits.findFirstByRepository_IdAndSha(activityRepo(), "batch-first").orElseThrow().getId();
        mvc.perform(post("/api/workspaces/301/git-activity/rules/commits/{id}/validate", commitId)
                        .header("Authorization", "Bearer " + activityToken).header("Idempotency-Key", "batch-replay"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/workspaces/399/git-activity/rules/validate")
                        .header("Authorization", "Bearer " + activityToken).header("Idempotency-Key", "batch-replay"))
                .andExpect(status().isForbidden());
    }

    @Test void liveRepositoryExcludesPreservedMockDataFromListsAndRevalidation() throws Exception {
        var mockRepository = tx.execute(status -> {
            var repo = new com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository();
            repo.setRootProject(projects.getReferenceById(masterId));
            repo.setExternalId(9999000L);
            repo.setOwner("fixture"); repo.setName("kept-demo"); repo.setFullName("fixture/kept-demo");
            repo.setMockData(true); repo.setStatus(com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepositoryStatus.ACTIVE);
            repo.setSyncStatus(com.example.starter_project_2025.system.project.developmentinsights.domain.GitSyncStatus.READY);
            repo.setLinkedAt(Instant.now());
            return activityRepositories.saveAndFlush(repo).getId();
        });
        tx.executeWithoutResult(status -> {
            var author = new com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor();
            author.setRootProject(projects.getReferenceById(masterId)); author.setExternalId(9999001L); author.setLogin("kept-mock-author");
            author = activityContributors.saveAndFlush(author);
            var commit = new com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit();
            commit.setRepository(activityRepositories.getReferenceById(mockRepository)); commit.setSha("kept-mock-sha");
            commit.setMessage("feat: " + moduleTask.getTaskKey()); commit.setAuthorContributor(author); commit.setCommittedAt(Instant.now());
            activityCommits.saveAndFlush(commit);
        });
        push(commit("real-source", "feat: " + moduleTask.getTaskKey(), "2026-11-17T10:00:00Z"));
        refresh();
        mvc.perform(get("/api/workspaces/301/git-activity/commits").header("Authorization", "Bearer " + activityToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(post("/api/workspaces/301/git-activity/rules/validate").header("Authorization", "Bearer " + activityToken)
                        .header("Idempotency-Key", "live-only"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        var preserved = activityRepositories.findById(mockRepository).orElseThrow();
        assertThat(preserved.isMockData()).isTrue();
        assertThat(preserved.getStatus().name()).isEqualTo("INACTIVE");
        assertThat(activityCommits.findFirstByRepository_IdAndSha(mockRepository, "kept-mock-sha")).isPresent();
    }

    @Test void pullRequestStateAutoRemovalManualPinAndRelinkKeepStableActivityIds() throws Exception {
        deliverAndProcess("pull_request", pullRequest("opened", 88, "feat: " + moduleTask.getTaskKey(), "feature/stable", "2026-11-17T09:00:00Z"));
        refresh();
        var source = pullRequests.findByRepository_IdAndNumber(connectionId, 88).orElseThrow();
        var projected = activityPrs.findFirstByRepository_IdAndExternalId(activityRepo(), source.getExternalId()).orElseThrow();
        deliverAndProcess("pull_request", pullRequest("edited", 88, "feat: without a Task", "feature/stable", "2026-11-17T10:00:00Z"));
        refresh();
        assertThat(activityLinks.findAllByPullRequest_IdOrderByTask_IdAsc(projected.getId())).isEmpty();
        mvc.perform(post("/api/workspaces/301/git-activity/unmapped/links").header("Authorization", "Bearer " + activityToken)
                .contentType("application/json").content("{\"type\":\"PULL_REQUEST\",\"activityId\":" + projected.getId() + ",\"taskId\":" + moduleTask.getId() + "}"))
                .andExpect(status().isOk());
        deliverAndProcess("pull_request", pullRequest("closed", 88, "feat: still without a Task", "feature/stable", "2026-11-17T11:00:00Z"));
        refresh();
        assertThat(activityPrs.findById(projected.getId()).orElseThrow().getState().name()).isEqualTo("CLOSED");
        assertThat(activityLinks.findAllByPullRequest_IdOrderByTask_IdAsc(projected.getId())).singleElement()
                .satisfies(link -> assertThat(link.getSource().name()).isEqualTo("MANUAL"));
        long repositoryId = activityRepo();
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.INACTIVE));
        integration.request(connectionId);
        refresh();
        tx.executeWithoutResult(status -> {
            var repository = connections.findById(connectionId).orElseThrow();
            repository.setStatus(GitRepositoryStatus.ACTIVE);
            repository.setLinkedAt(java.time.LocalDateTime.now());
        });
        integration.request(connectionId);
        refresh();
        assertThat(activityRepo()).isEqualTo(repositoryId);
        assertThat(activityPrs.findFirstByRepository_IdAndExternalId(repositoryId, source.getExternalId()).orElseThrow().getId()).isEqualTo(projected.getId());
        assertThat(activityLinks.findAllByPullRequest_IdOrderByTask_IdAsc(projected.getId())).hasSize(1);
    }

    @Test void durableWorkerRecoversAnEditWhoseAfterCommitMappingWasLost() throws Exception {
        deliverAndProcess("pull_request", pullRequest("opened", 89, "feat: " + masterTask.getTaskKey(), "feature/recovery", "2026-11-17T09:00:00Z"));
        refresh();
        var original = pullRequests.findByRepository_IdAndNumber(connectionId, 89).orElseThrow();
        tx.executeWithoutResult(status -> {
            var pr = pullRequests.findById(original.getId()).orElseThrow();
            // Equivalent persisted source state after ingestion commits but before its listener ran.
            pr.setTitle("feat: " + moduleTask.getTaskKey());
            pr.setGithubUpdatedAt(pr.getGithubUpdatedAt().plusHours(1));
            publisher.publishEvent(new com.example.starter_project_2025.system.git_integration.ingestion.event.GitSourceChangedEvent(connectionId));
        });
        refresh();
        var projected = activityPrs.findFirstByRepository_IdAndExternalId(activityRepo(), original.getExternalId()).orElseThrow();
        assertThat(activityLinks.findAllByPullRequest_IdOrderByTask_IdAsc(projected.getId()))
                .extracting(link -> link.getTask().getId()).containsExactly(moduleTask.getId());
    }

    @Test void anOldClaimedWorkerCannotOverwriteMetadataOrErrorStateAfterRelink() {
        Long jobId = tx.execute(status -> jobs.saveAndFlush(GitSyncJob.builder()
                .tenant(tenants.getReferenceById(tenantId)).repository(connections.getReferenceById(connectionId))
                .type(GitSyncJobType.MANUAL).status(GitSyncJobStatus.PENDING).maxAttempts(3)
                .nextRunAt(java.time.LocalDateTime.now().minusSeconds(1)).build()).getId());
        var claimed = syncStore.claim(jobId).orElseThrow();
        tx.executeWithoutResult(status -> {
            var repo = connections.findById(connectionId).orElseThrow();
            repo.setLinkedAt(java.time.LocalDateTime.now().plusSeconds(1));
            jobs.findById(jobId).orElseThrow().setStatus(GitSyncJobStatus.FAILED);
        });
        var staleMetadata = new com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository(REPO,
                "stale-name", "old/stale-name", new com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository.Owner("old"),
                "https://github.com/old/stale-name", true, "private", "stale-branch", false, false);
        assertThatThrownBy(() -> syncStore.startCommits(claimed, staleMetadata, Map.of()))
                .isInstanceOf(com.example.starter_project_2025.system.git_integration.sync.GitSyncJobStore.SupersededSync.class);
        syncStore.repositoryLost(claimed, "OLD_404", "stale failure");
        syncStore.completePullRequests(claimed);
        var repo = connections.findById(connectionId).orElseThrow();
        assertThat(repo.getName()).isEqualTo("webshop");
        assertThat(repo.getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
        assertThat(repo.getLastSyncedAt()).isNull();
    }

    @Test void readPermissionDoesNotGrantReportExportPermission() throws Exception {
        String readOnly = tx.execute(status -> token(user(tenants.findById(tenantId).orElseThrow(),
                role("ACTIVITY-READ-", "WORKSPACE_READ", "SPRINT_BACKLOG_READ"))));
        mvc.perform(get("/api/workspaces/301/git-activity/reports/export/project").header("Authorization", "Bearer " + readOnly).param("format", "PDF"))
                .andExpect(status().isForbidden());
    }

    @Test void equalTimestampPullRequestDeliveriesUseCurrentGitHubStateForCloseAndReopen() throws Exception {
        String time = "2026-11-17T10:00:00Z";
        var closed = pullRequest("closed", 95, "feat: " + masterTask.getTaskKey(), "feature/tie", time);
        deliverAndProcess("pull_request", closed);
        installationTokens.invalidate(GITHUB_INSTALLATION_ID);
        when(github.createContentsToken(GITHUB_INSTALLATION_ID)).thenReturn(new GitHubInstallationToken("fixture-token", Instant.now().plusSeconds(3600)));
        when(github.getPullRequest(anyString(), anyString(), anyString(), eq(95))).thenReturn(closed.path("pull_request"));
        deliverAndProcess("pull_request", pullRequest("opened", 95, "feat: " + masterTask.getTaskKey(), "feature/tie", time));
        var source = pullRequests.findByRepository_IdAndNumber(connectionId, 95).orElseThrow();
        assertThat(source.getState()).isEqualTo(GitPullRequestState.CLOSED);
        refresh();
        var reopened = pullRequest("reopened", 95, "feat: " + moduleTask.getTaskKey(), "feature/tie", time);
        when(github.getPullRequest(anyString(), anyString(), anyString(), eq(95))).thenReturn(reopened.path("pull_request"));
        deliverAndProcess("pull_request", reopened);
        refresh();
        deliverAndProcess("pull_request", closed);
        var repository = tx.execute(status -> {
            var repo = connections.findById(connectionId).orElseThrow();
            repo.getInstallation().getInstallationId();
            return repo;
        });
        ingestion.upsertPullRequest(repository, mapper.pullRequest(closed.path("pull_request")), "sync",
                GitIngestionService.IngestOrigin.syncJob(null), GitIngestionService.UpsertMode.SYNC);
        assertThat(pullRequests.findById(source.getId()).orElseThrow().getState()).isEqualTo(GitPullRequestState.OPEN);
        var projected = activityPrs.findFirstByRepository_IdAndExternalId(activityRepo(), source.getExternalId()).orElseThrow();
        assertThat(projected.getState().name()).isEqualTo("OPEN");
        assertThat(activityLinks.findAllByPullRequest_IdOrderByTask_IdAsc(projected.getId())).extracting(link -> link.getTask().getId())
                .containsExactly(moduleTask.getId());
    }

    @Test void aRecoveredWorkerCannotWriteIntoTheNextClaimOrARateLimitedRetry() {
        Long jobId = tx.execute(status -> jobs.saveAndFlush(GitSyncJob.builder()
                .tenant(tenants.getReferenceById(tenantId)).repository(connections.getReferenceById(connectionId))
                .type(GitSyncJobType.MANUAL).status(GitSyncJobStatus.PENDING).maxAttempts(3)
                .nextRunAt(java.time.LocalDateTime.now().minusSeconds(1)).build()).getId());
        var first = syncStore.claim(jobId).orElseThrow();
        tx.executeWithoutResult(status -> {
            var job = jobs.findById(jobId).orElseThrow();
            job.setStartedAt(java.time.LocalDateTime.now().minusHours(1));
            job.setLastClaimedAt(java.time.LocalDateTime.now().minusHours(1));
        });
        assertThat(syncStore.requeueStuck()).isEqualTo(1);
        var second = syncStore.claim(jobId).orElseThrow();
        assertThat(second.claimToken()).isNotEqualTo(first.claimToken());
        assertThat(syncStore.requeueStuck()).isZero(); // time out the new claim, not the start of the whole sync
        var metadata = new com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository(REPO,
                "stale", "old/stale", new com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository.Owner("old"),
                "https://github.com/old/stale", true, "private", "stale", false, false);
        assertThatThrownBy(() -> syncStore.startCommits(first, metadata, Map.of()))
                .isInstanceOf(com.example.starter_project_2025.system.git_integration.sync.GitSyncJobStore.SupersededSync.class);
        syncStore.checkpoint(first, new com.example.starter_project_2025.system.git_integration.sync.GitSyncJobStore.CommitPage(
                "stale-cursor", 1, 0, 0, false, null), "stale-head");
        syncStore.repositoryLost(first, "OLD_404", "old failure");
        syncStore.completePullRequests(first);
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.RUNNING);
        assertThat(jobs.findById(jobId).orElseThrow().getCommitCursor()).isNull();
        assertThat(connections.findById(connectionId).orElseThrow().getName()).isEqualTo("webshop");
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
        syncStore.postpone(second, 1L);
        tx.executeWithoutResult(status -> jobs.findById(jobId).orElseThrow().setNextRunAt(java.time.LocalDateTime.now().minusSeconds(1)));
        var third = syncStore.claim(jobId).orElseThrow();
        assertThat(third.attemptCount()).isEqualTo(second.attemptCount());
        assertThat(third.claimToken()).isNotEqualTo(second.claimToken());
        syncStore.completePullRequests(second);
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.RUNNING);
        assertThat(jobs.findById(jobId).orElseThrow().getClaimToken()).isEqualTo(third.claimToken());
        assertThat(connections.findById(connectionId).orElseThrow().getLastSyncedAt()).isNull();
    }
}
