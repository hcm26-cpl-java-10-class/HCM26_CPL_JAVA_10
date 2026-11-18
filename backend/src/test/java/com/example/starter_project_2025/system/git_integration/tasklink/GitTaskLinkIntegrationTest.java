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
class GitTaskLinkIntegrationTest extends AbstractTaskLinkIntegrationTest {

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
    void pullRequestsAreLinkedFromTitleOrDescriptionAndFollowEdits() throws Exception {
        deliverAndProcess("pull_request", pullRequest("opened", 7, "Add cart " + moduleTask.getTaskKey(), "feature/cart",
                "2026-11-17T09:00:00Z"));
        Long prId = pullRequests.findByRepositoryIdAndNumber(connectionId, 7).orElseThrow().getId();
        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(), GitArtifactType.PULL_REQUEST, prId))
                .isPresent();

        // The title no longer names the module task; the description names the master task.
        deliverAndProcess("pull_request", pullRequest("edited", 7, "Add cart", "Part of " + masterTask.getTaskKey(),
                "feature/cart", "2026-11-17T09:30:00Z", false));

        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(), GitArtifactType.PULL_REQUEST, prId))
                .isEmpty();
        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(masterTask.getId(), GitArtifactType.PULL_REQUEST, prId))
                .isPresent();
        assertThat(references.findBySourceTypeAndSourceId(GitArtifactType.PULL_REQUEST, prId)).singleElement()
                .satisfies(ref -> assertThat(ref.getSourceField()).isEqualTo(BacklogReferenceField.BODY));
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links", masterTask.getId())
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pullRequestCount").value(1))
                .andExpect(jsonPath("$.pullRequests[0].pullRequest.number").value(7))
                .andExpect(jsonPath("$.pullRequests[0].link.source").value("AUTO"))
                .andExpect(jsonPath("$.pullRequests[0].link.field").value("BODY"));
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
}
