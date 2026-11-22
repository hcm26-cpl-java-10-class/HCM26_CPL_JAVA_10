package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobQueue;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.TeamAllocationSession;
import com.example.starter_project_2025.system.project.TeamAllocationSessionRepository;
import com.example.starter_project_2025.system.project.TeamAllocationSessionStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * US-SY-06 acceptance criteria: synchronization history of the project's repository (sync jobs and
 * webhook deliveries in one list), detail, empty state and retry of a failed webhook. Pam is the PM
 * of the master's team, Alice a developer of it, Bob the PM of a module's team.
 */
class SyncHistoryIntegrationTest extends AbstractTaskLinkIntegrationTest {

    private static final LocalDateTime T0 = LocalDateTime.of(2026, 11, 20, 9, 0);

    @Autowired GitSyncJobQueue queue;
    @Autowired TrainingClassRepository classes;
    @Autowired TeamAllocationSessionRepository allocationSessions;
    @Autowired ClassMemberRepository classMembers;
    @Autowired ProjectTeamRepository teams;
    @Autowired ProjectMemberRepository memberships;

    String pamToken;
    String aliceToken;
    String bobToken;
    User pam;

    @BeforeEach
    void members() {
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.findById(tenantId).orElseThrow();
            TrainingClass trainingClass = new TrainingClass();
            trainingClass.setCode("SY6-" + UUID.randomUUID());
            trainingClass.setName("SY-06 class");
            trainingClass.setTenantId(tenantId);
            trainingClass.setProgramId(1L);
            trainingClass.setStatus(TrainingClassStatus.ONGOING);
            classes.saveAndFlush(trainingClass);
            TeamAllocationSession session = new TeamAllocationSession();
            session.setTrainingClass(trainingClass);
            session.setMaxMembers(6);
            session.setStatus(TeamAllocationSessionStatus.PUBLISHED);
            allocationSessions.saveAndFlush(session);
            ProjectTeam masterTeam = team("Shop team", trainingClass, session, masterId);
            ProjectTeam moduleTeam = team("Cart team", trainingClass, session, moduleId);
            pam = person(tenant, "Pam");
            User alice = person(tenant, "Alice");
            User bob = person(tenant, "Bob");
            join(masterTeam, trainingClass, pam, "PM");
            join(masterTeam, trainingClass, alice, "DEV");
            join(moduleTeam, trainingClass, bob, "PM");
            pamToken = token(pam);
            aliceToken = token(alice);
            bobToken = token(bob);
        });
    }

    // ---- AC01 · List --------------------------------------------------------------------------------

    @Test
    void ac01TheHistoryListsJobsAndWebhooksNewestFirstWithTimeTypeAndStatus() throws Exception {
        Long initial = job(GitSyncJobType.INITIAL, GitSyncJobStatus.SUCCEEDED, T0, "{\"commitsInserted\":40,\"commitsExisting\":2,\"pullRequestsInserted\":5}");
        Long reconcile = job(GitSyncJobType.SCHEDULED, GitSyncJobStatus.PARTIAL, T0.plusHours(6), "{\"commitsInserted\":3}");
        Long manual = job(GitSyncJobType.MANUAL, GitSyncJobStatus.FAILED, T0.plusHours(7), null);
        Long processed = webhook(GitWebhookEventStatus.PROCESSED, T0.plusHours(8), 2, false);
        Long failed = webhook(GitWebhookEventStatus.FAILED, T0.plusHours(9), null, false);
        webhook(GitWebhookEventStatus.IGNORED, T0.plusHours(10), null, false); // not a synchronization
        Long retrying = webhook(GitWebhookEventStatus.FAILED_RETRYABLE, T0.plusHours(11), null, false);

        history(pamToken, "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasRepository").value(true))
                .andExpect(jsonPath("$.repositoryId").value(connectionId))
                .andExpect(jsonPath("$.totalElements").value(6))
                .andExpect(jsonPath("$.items", hasSize(6)))
                .andExpect(jsonPath("$.items[0].id").value(retrying))
                .andExpect(jsonPath("$.items[0].status").value("PROCESSING"))
                .andExpect(jsonPath("$.items[0].retryAt").exists())
                .andExpect(jsonPath("$.items[1].id").value(failed))
                .andExpect(jsonPath("$.items[1].source").value("WEBHOOK"))
                .andExpect(jsonPath("$.items[1].type").value("WEBHOOK"))
                .andExpect(jsonPath("$.items[1].status").value("FAILED"))
                .andExpect(jsonPath("$.items[1].error").value("GitHub API 502"))
                .andExpect(jsonPath("$.items[1].canRetry").value(true))
                .andExpect(jsonPath("$.items[2].id").value(processed))
                .andExpect(jsonPath("$.items[2].status").value("SUCCESS"))
                .andExpect(jsonPath("$.items[2].recordsProcessed").value(2))
                .andExpect(jsonPath("$.items[2].eventType").value("push"))
                .andExpect(jsonPath("$.items[3].id").value(manual))
                .andExpect(jsonPath("$.items[3].type").value("MANUAL"))
                .andExpect(jsonPath("$.items[3].status").value("FAILED"))
                .andExpect(jsonPath("$.items[3].errorCode").value("GITHUB_UNAVAILABLE"))
                .andExpect(jsonPath("$.items[4].id").value(reconcile))
                .andExpect(jsonPath("$.items[4].type").value("RECONCILE"))
                .andExpect(jsonPath("$.items[4].status").value("PARTIAL_SUCCESS"))
                .andExpect(jsonPath("$.items[5].id").value(initial))
                .andExpect(jsonPath("$.items[5].type").value("INITIAL"))
                .andExpect(jsonPath("$.items[5].status").value("SUCCESS"))
                .andExpect(jsonPath("$.items[5].recordsProcessed").value(47))
                .andExpect(jsonPath("$.items[5].durationMs").value(120000))
                .andExpect(jsonPath("$.items[5].repository.fullName").value("hcm26-java-team/webshop"));

        // Filters and paging.
        history(pamToken, "?type=WEBHOOK").andExpect(jsonPath("$.totalElements").value(3));
        history(pamToken, "?type=RECONCILE").andExpect(jsonPath("$.items[0].id").value(reconcile));
        history(pamToken, "?status=FAILED").andExpect(jsonPath("$.totalElements").value(2));
        history(pamToken, "?status=PROCESSING").andExpect(jsonPath("$.items[0].id").value(retrying));
        history(pamToken, "?size=2&page=1")
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].id").value(processed))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void aPartiallyReadPushIsAPartialSuccess() throws Exception {
        Long partial = webhook(GitWebhookEventStatus.PROCESSED, T0, 20, true);

        history(pamToken, "?status=PARTIAL_SUCCESS")
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(partial));
        history(pamToken, "?status=SUCCESS").andExpect(jsonPath("$.totalElements").value(0));
    }

    // ---- AC02 · Detail ------------------------------------------------------------------------------

    @Test
    void ac02TheDetailShowsTheRecordsProcessedAndTheError() throws Exception {
        Long initial = job(GitSyncJobType.INITIAL, GitSyncJobStatus.SUCCEEDED, T0,
                "{\"commitsInserted\":40,\"commitsExisting\":2,\"pullRequestsInserted\":5,\"reviewsInserted\":7}");
        Long manual = job(GitSyncJobType.MANUAL, GitSyncJobStatus.FAILED, T0.plusHours(1), null);
        Long processed = webhook(GitWebhookEventStatus.PROCESSED, T0.plusHours(2), 2, false);
        Long failed = webhook(GitWebhookEventStatus.FAILED, T0.plusHours(3), null, false);

        String body = detail(pamToken, "job", initial)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.item.recordsProcessed").value(54))
                .andExpect(jsonPath("$.breakdown.commitsInserted").value(40))
                .andExpect(jsonPath("$.breakdown.commitsExisting").value(2))
                .andExpect(jsonPath("$.breakdown.pullRequestsInserted").value(5))
                .andExpect(jsonPath("$.breakdown.reviewsInserted").value(7))
                .andExpect(jsonPath("$.error").doesNotExist())
                .andExpect(jsonPath("$.job.phase").value("DONE"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body.toLowerCase()).doesNotContain("token").doesNotContain("payload\"");

        detail(pamToken, "job", manual)
                .andExpect(jsonPath("$.item.status").value("FAILED"))
                .andExpect(jsonPath("$.error.code").value("GITHUB_UNAVAILABLE"))
                .andExpect(jsonPath("$.error.message").value("GitHub returned 502"))
                .andExpect(jsonPath("$.job.canSyncAgain").value(true)); // the latest synchronization, stopped
        detail(pamToken, "webhook", processed)
                .andExpect(jsonPath("$.item.recordsProcessed").value(2))
                .andExpect(jsonPath("$.note").value("ref=refs/heads/main, inserted=2, existing=0"))
                .andExpect(jsonPath("$.error").doesNotExist());
        detail(pamToken, "webhook", failed)
                .andExpect(jsonPath("$.error.message").value("GitHub API 502"))
                .andExpect(jsonPath("$.webhook.payloadAvailable").value(true))
                .andExpect(jsonPath("$.webhook.retryBlockedReason").doesNotExist());
        detail(pamToken, "unknown", failed).andExpect(status().isNotFound());
    }

    // ---- AC03 · Empty -------------------------------------------------------------------------------

    @Test
    void ac03ARepositoryNeverSynchronizedSaysThereIsNoHistoryYet() throws Exception {
        history(pamToken, "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasRepository").value(true))
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.items", hasSize(0)));

        // A project that never linked a repository.
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setProjectId(otherProjectId));
        history(pamToken, "").andExpect(status().isOk()).andExpect(jsonPath("$.hasRepository").value(false));
    }

    // ---- AC04 · Retry -------------------------------------------------------------------------------

    @Test
    void ac04RetryProcessesAFailedWebhookAgainAndItsStatusFollowsTheResult() throws Exception {
        push(commit("a".repeat(40), "Shop landing page", "2026-11-22T09:00:00+07:00"));
        GitWebhookEvent event = events.findAll().stream().filter(row -> "push".equals(row.getEventType())).findFirst().orElseThrow();
        assertThat(event.getRecordsProcessed()).isEqualTo(1);
        // As if every attempt had failed.
        tx.executeWithoutResult(status -> {
            GitWebhookEvent row = events.findById(event.getId()).orElseThrow();
            row.setStatus(GitWebhookEventStatus.FAILED);
            row.setRecordsProcessed(null);
            row.setLastError("GitHub API 502");
        });

        retry(pamToken, event.getId()).andExpect(status().isAccepted());
        history(pamToken, "").andExpect(jsonPath("$.items[0].status").value("PENDING"));
        processor.process(event.getId());

        history(pamToken, "")
                .andExpect(jsonPath("$.items[0].id").value(event.getId()))
                .andExpect(jsonPath("$.items[0].status").value("SUCCESS"))
                .andExpect(jsonPath("$.items[0].recordsProcessed").value(1)) // already stored: not duplicated
                .andExpect(jsonPath("$.items[0].canRetry").value(false));
        assertThat(commits.countByRepositoryId(connectionId)).isEqualTo(1);

        retry(pamToken, event.getId()) // no longer failed
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_EVENT_NOT_REPLAYABLE"));
    }

    @Test
    void retryIsRefusedWhenThePayloadIsGoneOrTheRepositoryNoLongerReceivesEvents() throws Exception {
        Long purged = webhook(GitWebhookEventStatus.FAILED, T0, null, false);
        tx.executeWithoutResult(status -> events.findById(purged).orElseThrow().setPayload(null));
        detail(pamToken, "webhook", purged).andExpect(jsonPath("$.webhook.retryBlockedReason").value("PAYLOAD_PURGED"));
        retry(pamToken, purged)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_WEBHOOK_PAYLOAD_PURGED"));

        Long failed = webhook(GitWebhookEventStatus.FAILED, T0.plusHours(1), null, false);
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.INACTIVE));
        history(pamToken, "?repositoryId=" + connectionId).andExpect(jsonPath("$.items[0].canRetry").value(false));
        retry(pamToken, failed)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_REPOSITORY_NOT_RECEIVING"));
    }

    @Test
    void anEventOfAnotherProjectIsNotFound() throws Exception {
        GitRepository other = connections.saveAndFlush(GitRepository.builder()
                .tenantId(tenantId).projectId(otherProjectId).installationRef(connections.findById(connectionId).orElseThrow().getInstallationRef())
                .provider(GitProvider.GITHUB).externalId(9399L).ownerLogin("hcm26-java-team").name("bank")
                .fullName("hcm26-java-team/bank").htmlUrl("https://github.com/hcm26-java-team/bank")
                .visibility("private").defaultBranch("main").status(GitRepositoryStatus.ACTIVE)
                .linkedByUserId(1L).linkedAt(LocalDateTime.now()).build());
        Long foreign = webhook(GitWebhookEventStatus.FAILED, T0, null, false, other.getId());

        detail(managerToken, "webhook", foreign).andExpect(status().isNotFound());
        retry(managerToken, foreign).andExpect(status().isNotFound());
        history(managerToken, "?repositoryId=" + other.getId()).andExpect(status().isNotFound());
    }

    // ---- BR5 · Permission ---------------------------------------------------------------------------

    @Test
    void br5OnlyWhoManagesTheProjectSeesTheHistoryAndRetries() throws Exception {
        Long failed = webhook(GitWebhookEventStatus.FAILED, T0, null, false);

        history(managerToken, "").andExpect(status().isOk());
        for (String token : new String[]{aliceToken, bobToken, readerToken}) {
            history(token, "").andExpect(status().isForbidden());
            detail(token, "webhook", failed).andExpect(status().isForbidden());
            retry(token, failed).andExpect(status().isForbidden());
        }
        assertThat(events.findById(failed).orElseThrow().getStatus()).isEqualTo(GitWebhookEventStatus.FAILED);

        mvc.perform(get("/api/v1/git-integration/projects/" + masterId + "/repository").header("Authorization", "Bearer " + pamToken))
                .andExpect(jsonPath("$.canViewSyncHistory").value(true));
        mvc.perform(get("/api/v1/git-integration/projects/" + masterId + "/repository").header("Authorization", "Bearer " + aliceToken))
                .andExpect(jsonPath("$.canViewSyncHistory").value(false));
        // A module reads its master's history, for whoever manages the master; never "Sync again" from there.
        Long stopped = job(GitSyncJobType.MANUAL, GitSyncJobStatus.FAILED, T0.plusHours(1), null);
        mvc.perform(get(url(moduleId)).header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repositoryId").value(connectionId));
        mvc.perform(get(url(moduleId) + "/job/" + stopped).header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.job.canSyncAgain").value(false));
        mvc.perform(get(url(masterId) + "/job/" + stopped).header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.job.canSyncAgain").value(true));
    }

    // ---- BR1 · Every synchronization is kept ---------------------------------------------------------

    @Test
    void br1AResumeIsANewSynchronizationAndTheStoppedOneKeepsItsResult() throws Exception {
        LocalDateTime finished = T0.plusMinutes(2);
        Long stopped = tx.execute(status -> jobs.saveAndFlush(GitSyncJob.builder().tenantId(tenantId).repositoryId(connectionId)
                .type(GitSyncJobType.SCHEDULED).status(GitSyncJobStatus.PARTIAL).maxAttempts(3).attemptCount(3)
                .nextRunAt(T0).startedAt(T0).finishedAt(finished).errorCode("GITHUB_UNAVAILABLE")
                .phase(GitSyncPhase.COMMITS).commitCursor("cursor-7").commitSince(T0.minusDays(30))
                .commitBranch("refs/heads/main").commitHeadOid("f".repeat(40)).pagesDone(7).build()).getId());

        GitSyncJob resumed = queue.request(connectionId, GitSyncJobType.MANUAL, pam.getId(), LocalDateTime.now().plusHours(1))
                .orElseThrow().job();

        assertThat(resumed.getId()).isNotEqualTo(stopped);
        assertThat(resumed.getType()).isEqualTo(GitSyncJobType.MANUAL);
        assertThat(resumed.getResumedFromJobId()).isEqualTo(stopped);
        assertThat(resumed.getPhase()).isEqualTo(GitSyncPhase.COMMITS);
        assertThat(resumed.getCommitCursor()).isEqualTo("cursor-7");
        assertThat(resumed.getCommitBranch()).isEqualTo("refs/heads/main");
        assertThat(resumed.pages()).isZero();
        GitSyncJob old = jobs.findById(stopped).orElseThrow();
        assertThat(old.getStatus()).isEqualTo(GitSyncJobStatus.PARTIAL);
        assertThat(old.getFinishedAt()).isEqualTo(finished);
        assertThat(old.getErrorCode()).isEqualTo("GITHUB_UNAVAILABLE");

        history(pamToken, "")
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[0].id").value(resumed.getId()))
                .andExpect(jsonPath("$.items[0].status").value("PENDING"))
                .andExpect(jsonPath("$.items[1].id").value(stopped))
                .andExpect(jsonPath("$.items[1].status").value("PARTIAL_SUCCESS"));
        detail(pamToken, "job", resumed.getId())
                .andExpect(jsonPath("$.job.resumedFromJobId").value(stopped))
                .andExpect(jsonPath("$.job.requestedBy.id").value(pam.getId()));
        // Asked again while it waits: the same job, nothing new.
        assertThat(queue.request(connectionId, GitSyncJobType.MANUAL, pam.getId(), LocalDateTime.now()).orElseThrow().queued()).isFalse();
    }

    // ---- helpers ------------------------------------------------------------------------------------

    private static String url(Long projectId) {
        return "/api/v1/git-integration/projects/" + projectId + "/repository/sync-history";
    }

    private ResultActions history(String token, String query) throws Exception {
        return mvc.perform(get(url(masterId) + query).header("Authorization", "Bearer " + token));
    }

    private ResultActions detail(String token, String source, Long id) throws Exception {
        return mvc.perform(get(url(masterId) + "/" + source + "/" + id).header("Authorization", "Bearer " + token));
    }

    private ResultActions retry(String token, Long id) throws Exception {
        return mvc.perform(post(url(masterId) + "/webhook/" + id + "/retry").header("Authorization", "Bearer " + token));
    }

    /** A finished job that ran two minutes from {@code at}. */
    private Long job(GitSyncJobType type, GitSyncJobStatus status, LocalDateTime at, String stats) {
        boolean failed = status == GitSyncJobStatus.FAILED || status == GitSyncJobStatus.PARTIAL;
        return tx.execute(s -> jobs.saveAndFlush(GitSyncJob.builder().tenantId(tenantId).repositoryId(connectionId)
                .type(type).status(status).maxAttempts(3).attemptCount(1).nextRunAt(at)
                .startedAt(at).finishedAt(at.plusMinutes(2)).statsJson(stats)
                .phase(status == GitSyncJobStatus.SUCCEEDED ? GitSyncPhase.DONE : GitSyncPhase.METADATA)
                .errorCode(failed ? "GITHUB_UNAVAILABLE" : null)
                .errorMessage(failed ? "GitHub returned 502" : null).build()).getId());
    }

    private Long webhook(GitWebhookEventStatus status, LocalDateTime at, Integer records, boolean partial) {
        return webhook(status, at, records, partial, connectionId);
    }

    /** A push delivery of {@code repositoryRef} received at {@code at}. */
    private Long webhook(GitWebhookEventStatus status, LocalDateTime at, Integer records, boolean partial, Long repositoryRef) {
        boolean failing = status == GitWebhookEventStatus.FAILED || status == GitWebhookEventStatus.FAILED_RETRYABLE;
        String note = status == GitWebhookEventStatus.PROCESSED ? "ref=refs/heads/main, inserted=" + records + ", existing=0" : null;
        return events.saveAndFlush(GitWebhookEvent.builder().provider(GitProvider.GITHUB).deliveryId("d-" + UUID.randomUUID())
                .eventType("push").installationId(GITHUB_INSTALLATION_ID).repoExternalId(REPO)
                .repoFullName("hcm26-java-team/webshop").senderLogin("octocat").tenantId(tenantId)
                .repositoryRef(repositoryRef).payload("{\"ref\":\"refs/heads/main\"}").payloadBytes(24)
                .status(status).attempts(failing ? 6 : 1).nextAttemptAt(at.plusMinutes(5))
                .lastError(failing ? "GitHub API 502" : note).receivedAt(at)
                .processingStartedAt(at.plusSeconds(1)).processedAt(status.terminal() ? at.plusSeconds(3) : null)
                .recordsProcessed(records).partialResult(partial ? Boolean.TRUE : null).build()).getId();
    }

    private ProjectTeam team(String name, TrainingClass trainingClass, TeamAllocationSession session, Long projectId) {
        ProjectTeam team = new ProjectTeam();
        team.setTeamName(name);
        team.setTrainingClass(trainingClass);
        team.setAllocationSession(session);
        team.setMaxMembers(6);
        team.setStatus(ProjectTeamStatus.ACTIVE);
        team.setProject(projects.findById(projectId).orElseThrow());
        return teams.saveAndFlush(team);
    }

    private User person(Tenant tenant, String first) {
        User user = user(tenant, role("SY6-", "SPRINT_BACKLOG_READ"));
        user.setFirstName(first);
        user.setLastName("Tester");
        return users.saveAndFlush(user);
    }

    private void join(ProjectTeam team, TrainingClass trainingClass, User user, String role) {
        ClassMember classMember = new ClassMember();
        classMember.setTrainingClass(trainingClass);
        classMember.setUser(user);
        classMember.setStatus(ClassMemberStatus.ACTIVE);
        classMembers.saveAndFlush(classMember);
        ProjectMember membership = new ProjectMember();
        membership.setTeam(team);
        membership.setClassMember(classMember);
        membership.setRole(role);
        memberships.saveAndFlush(membership);
    }
}
