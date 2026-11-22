package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobStore;
import com.example.starter_project_2025.system.notification.Notification;
import com.example.starter_project_2025.system.notification.NotificationRepository;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * US-GI-07 acceptance criteria: disconnect a GitHub account / organization from the platform
 * (GitHub mocked). Pam is the PM of the master's team; Ivan installed the App (read permission only).
 */
class GitInstallationDisconnectIntegrationTest extends AbstractTaskLinkIntegrationTest {

    private static final String ACCOUNT = "hcm26-java-team";

    @Autowired NotificationRepository notifications;
    @Autowired InstallationTokenProvider installationTokens;
    @Autowired GitSyncJobStore store;
    @Autowired TrainingClassRepository classes;
    @Autowired TeamAllocationSessionRepository allocationSessions;
    @Autowired ClassMemberRepository classMembers;
    @Autowired ProjectTeamRepository teams;
    @Autowired ProjectMemberRepository memberships;

    Long installationRowId;
    User pam;
    String pamToken;
    User ivan;
    String ivanToken;

    @BeforeEach
    void people() {
        installationTokens.invalidate(GITHUB_INSTALLATION_ID);
        installationRowId = connections.findById(connectionId).orElseThrow().getInstallationRef();
        when(github.createInstallationToken(anyLong()))
                .thenReturn(new GitHubInstallationToken("ghs_test", Instant.now().plusSeconds(3600)));
        when(github.deleteInstallation(GITHUB_INSTALLATION_ID)).thenReturn(GitHubApiClient.DeleteOutcome.DELETED);
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.findById(tenantId).orElseThrow();
            pam = person(tenant, "Pam", "SPRINT_BACKLOG_READ");
            joinTeamOf(masterId, pam, "PM");
            pamToken = token(pam);
            ivan = person(tenant, "Ivan", "GIT_INTEGRATION_READ");
            ivanToken = token(ivan);
            GitInstallation installation = installations.findById(installationRowId).orElseThrow();
            installation.setConnectedByUserId(ivan.getId());
            installations.saveAndFlush(installation);
        });
    }

    // ---- AC01 · Disconnect ------------------------------------------------------------------------

    @Test
    void ac01TheAppIsUninstalledAndTheInstallationAndItsRepositoriesAreDisconnected() throws Exception {
        GitRepository erroring = connections.saveAndFlush(connection(9311L, "api", GitRepositoryStatus.ERROR, otherProjectId));
        GitRepository unlinked = connections.saveAndFlush(connection(9312L, "old", GitRepositoryStatus.INACTIVE, masterId));
        Long waiting = queueJob(connectionId);

        String body = disconnect(managerToken, "hcm26-java-team")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.installation.status").value("DISCONNECTED"))
                .andExpect(jsonPath("$.installation.statusReason").value("DISCONNECTED_BY_USER"))
                .andExpect(jsonPath("$.installation.canDisconnect").value(false))
                .andExpect(jsonPath("$.repositoriesDisconnected").value(2))
                .andExpect(jsonPath("$.alreadyRemovedOnGitHub").value(false))
                .andExpect(jsonPath("$.projects", hasSize(2)))
                .andExpect(jsonPath("$.projects[?(@.id == " + masterId + ")].repositoryStatus").value("DISCONNECTED"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body.toLowerCase()).doesNotContain("token").doesNotContain("secret").doesNotContain("privatekey");
        verify(github, times(1)).deleteInstallation(GITHUB_INSTALLATION_ID);

        GitInstallation installation = installations.findById(installationRowId).orElseThrow();
        assertThat(installation.getStatus()).isEqualTo(GitInstallationStatus.DISCONNECTED);
        assertThat(installation.getDisconnectedByUserId()).isNotNull();
        for (Long id : new Long[]{connectionId, erroring.getId()}) {
            GitRepository row = connections.findById(id).orElseThrow();
            assertThat(row.getStatus()).isEqualTo(GitRepositoryStatus.DISCONNECTED);
            assertThat(row.getStatusReason()).isEqualTo("INSTALLATION_DELETED");
        }
        assertThat(connections.findById(unlinked.getId()).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.INACTIVE);
        GitSyncJob job = jobs.findById(waiting).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(job.getErrorCode()).isEqualTo("INSTALLATION_DISCONNECTED");

        // The PM of the master is told; GitHub was disconnected on purpose.
        assertThat(notifications.findTop30ByUser_IdOrderByCreatedAtDesc(pam.getId()))
                .singleElement().satisfies((Notification notification) -> {
                    assertThat(notification.getTitle()).isEqualTo("GitHub disconnected");
                    assertThat(notification.getMessage()).contains(ACCOUNT).contains("link the repository again");
                });
    }

    @Test
    void br1ThePersonWhoInstalledItMayDisconnectItWithoutManagingGitIntegration() throws Exception {
        mvc.perform(get("/api/v1/git-integration/github/installations").header("Authorization", "Bearer " + ivanToken))
                .andExpect(jsonPath("$.installations[0].canDisconnect").value(true));
        mvc.perform(get("/api/v1/git-integration/github/installations").header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$.installations[0].canDisconnect").value(false));

        disconnect(ivanToken, ACCOUNT)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.installation.disconnectedBy.id").value(ivan.getId()));
        // Ivan disconnected it: he is not told about his own action.
        assertThat(notifications.findTop30ByUser_IdOrderByCreatedAtDesc(ivan.getId())).isEmpty();
    }

    // ---- AC02 · Forbidden ---------------------------------------------------------------------------

    @Test
    void ac02SomeoneElseIsRefusedAndNothingChanges() throws Exception {
        for (String token : new String[]{readerToken, developerToken, pamToken}) {
            disconnect(token, ACCOUNT).andExpect(status().isForbidden());
        }
        disconnect(otherTenantToken, ACCOUNT).andExpect(status().isNotFound());

        verify(github, never()).deleteInstallation(anyLong());
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.CONNECTED);
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
    }

    // ---- AC03 · Wrong name -------------------------------------------------------------------------

    @Test
    void ac03AWrongNameDisconnectsNothingButTheCaseDoesNotMatter() throws Exception {
        disconnect(managerToken, "hcm26-java")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_DISCONNECT_CONFIRMATION_MISMATCH"));
        verify(github, never()).deleteInstallation(anyLong());
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.CONNECTED);

        disconnect(managerToken, "  HCM26-Java-Team ").andExpect(status().isOk());
    }

    // ---- AC04 · Already removed on GitHub --------------------------------------------------------------

    @Test
    void ac04AnAppAlreadyRemovedOnGitHubIsDisconnectedWithoutAnError() throws Exception {
        when(github.deleteInstallation(GITHUB_INSTALLATION_ID)).thenReturn(GitHubApiClient.DeleteOutcome.NOT_FOUND);

        disconnect(managerToken, ACCOUNT)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alreadyRemovedOnGitHub").value(true))
                .andExpect(jsonPath("$.installation.status").value("DISCONNECTED"))
                .andExpect(jsonPath("$.installation.statusReason").value("UNINSTALLED"));
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.DISCONNECTED);

        // Again (double click, a second admin): no error, GitHub is not called again.
        disconnect(managerToken, ACCOUNT).andExpect(status().isOk()).andExpect(jsonPath("$.alreadyRemovedOnGitHub").value(true));
        verify(github, times(1)).deleteInstallation(GITHUB_INSTALLATION_ID);
    }

    @Test
    void theDeletedWebhookAfterADisconnectionChangesNothingAndNotifiesNobodyAgain() throws Exception {
        disconnect(managerToken, ACCOUNT).andExpect(status().isOk());
        int before = notifications.findTop30ByUser_IdOrderByCreatedAtDesc(pam.getId()).size();

        deliverAndProcess("installation", installationEvent("deleted"));

        assertThat(installations.findById(installationRowId).orElseThrow().getStatusReason()).isEqualTo("DISCONNECTED_BY_USER");
        assertThat(notifications.findTop30ByUser_IdOrderByCreatedAtDesc(pam.getId())).hasSize(before);
    }

    @Test
    void ownerRemovingTheAppOnGitHubIsHandledTheSameWay() throws Exception {
        Long waiting = queueJob(connectionId);

        deliverAndProcess("installation", installationEvent("deleted"));

        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.DISCONNECTED);
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.DISCONNECTED);
        // BR6: exactly like a disconnection from the platform: the waiting job stops too.
        GitSyncJob job = jobs.findById(waiting).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(job.getErrorCode()).isEqualTo("INSTALLATION_DISCONNECTED");
        assertThat(installations.findById(installationRowId).orElseThrow().getStatusReason()).isEqualTo("UNINSTALLED");
    }

    @Test
    void whenGitHubFailsNothingChanges() throws Exception {
        when(github.deleteInstallation(GITHUB_INSTALLATION_ID))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "delete installation", 502));

        disconnect(managerToken, ACCOUNT)
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("GIT_PROVIDER_UNAVAILABLE"));
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.CONNECTED);
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
    }

    // ---- AC05 / AC06 · Data kept, later events ignored ---------------------------------------------------

    @Test
    void ac05AndAc06TheDataStaysLabelledAndLaterWebhooksAreIgnored() throws Exception {
        storeCommit("a".repeat(40));
        disconnect(managerToken, ACCOUNT).andExpect(status().isOk());

        mvc.perform(get("/api/v1/git-integration/projects/" + masterId + "/repository/commits").header("Authorization", "Bearer " + pamToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].repository.status").value("DISCONNECTED"));

        push(commit("b".repeat(40), "After the disconnection", "2026-11-22T10:00:00+07:00"));
        assertThat(commits.countByRepositoryId(connectionId)).isEqualTo(1);
        assertThat(events.findAll()).filteredOn(event -> "push".equals(event.getEventType()))
                .singleElement().satisfies(event -> assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.IGNORED));
    }

    // ---- AC07 · Running job -------------------------------------------------------------------------

    @Test
    void ac07ARunningJobStopsAsFailedBecauseTheInstallationWasDisconnected() throws Exception {
        Long running = tx.execute(status -> jobs.saveAndFlush(GitSyncJob.builder().tenantId(tenantId).repositoryId(connectionId)
                .type(GitSyncJobType.MANUAL).status(GitSyncJobStatus.PENDING).maxAttempts(3)
                .nextRunAt(LocalDateTime.now().minusSeconds(1)).build()).getId());
        GitSyncJobStore.ClaimedJob claimed = store.claim(running).orElseThrow();

        disconnect(managerToken, ACCOUNT).andExpect(status().isOk());
        assertThat(jobs.findById(running).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.RUNNING);

        // Its next page (or GitHub refusing the revoked token) stops it.
        assertThat(store.stoppedIfDisconnected(claimed)).isTrue();
        GitSyncJob job = jobs.findById(running).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(job.getErrorCode()).isEqualTo("INSTALLATION_DISCONNECTED");
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.DISCONNECTED);
    }

    // ---- BR7 · Connect again, link again ---------------------------------------------------------------

    @Test
    void br7AfterConnectingAgainTheSameRepositoryIsLinkedAgainWithoutDuplicatingItsData() throws Exception {
        storeCommit("c".repeat(40));
        disconnect(managerToken, ACCOUNT).andExpect(status().isOk());
        repositoryView(managerToken)
                .andExpect(jsonPath("$.repository.installationGone").value(true))
                .andExpect(jsonPath("$.canLink").value(true))
                .andExpect(jsonPath("$.canResync").value(false));

        Long newInstallation = reconnect();
        when(github.getRepository(anyString(), eq(REPO))).thenReturn(Optional.of(repo(REPO, "webshop")));
        link(managerToken, newInstallation, REPO)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.repository.id").value(connectionId))
                .andExpect(jsonPath("$.repository.status").value("ACTIVE"));

        GitRepository row = connections.findById(connectionId).orElseThrow();
        assertThat(row.getInstallationRef()).isEqualTo(newInstallation);
        assertThat(connections.findAll()).hasSize(1);
        assertThat(commits.countByRepositoryId(connectionId)).isEqualTo(1);
        assertThat(jobs.findFirstByRepositoryIdOrderByIdDesc(connectionId)).get()
                .satisfies(job -> assertThat(job.getType()).isEqualTo(GitSyncJobType.MANUAL));
    }

    @Test
    void br7AnotherRepositoryLinkedAfterwardsRetiresTheStrandedOne() throws Exception {
        disconnect(managerToken, ACCOUNT).andExpect(status().isOk());
        Long newInstallation = reconnect();
        when(github.getRepository(anyString(), eq(9320L))).thenReturn(Optional.of(repo(9320L, "webshop-v2")));

        link(managerToken, newInstallation, 9320L)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.repository.fullName").value("hcm26-java-team/webshop-v2"))
                .andExpect(jsonPath("$.previousRepositories[0].id").value(connectionId));
        GitRepository old = connections.findById(connectionId).orElseThrow();
        assertThat(old.getStatus()).isEqualTo(GitRepositoryStatus.INACTIVE);
        assertThat(old.getUnlinkedAt()).isNotNull();
    }

    // ---- helpers ------------------------------------------------------------------------------------

    private ResultActions disconnect(String token, String confirmLogin) throws Exception {
        return mvc.perform(post("/api/v1/git-integration/github/installations/" + installationRowId + "/disconnect")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("confirmLogin", confirmLogin))));
    }

    private ResultActions repositoryView(String token) throws Exception {
        return mvc.perform(get("/api/v1/git-integration/projects/" + masterId + "/repository").header("Authorization", "Bearer " + token));
    }

    private ResultActions link(String token, Long installation, long externalId) throws Exception {
        return mvc.perform(post("/api/v1/git-integration/projects/" + masterId + "/repository").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"installationId\": " + installation + ", \"externalId\": " + externalId + "}"));
    }

    /** GI-01 again: a new installation of the App on the same account. */
    private Long reconnect() {
        return installations.saveAndFlush(GitInstallation.builder()
                .tenantId(tenantId).provider(GitProvider.GITHUB).installationId(GITHUB_INSTALLATION_ID + 1)
                .accountId(1L).accountLogin(ACCOUNT).accountType("Organization").repositorySelection("all")
                .status(GitInstallationStatus.CONNECTED).connectedByUserId(1L)
                .connectedAt(LocalDateTime.now()).lastVerifiedAt(LocalDateTime.now()).build()).getId();
    }

    private com.fasterxml.jackson.databind.node.ObjectNode installationEvent(String action) {
        com.fasterxml.jackson.databind.node.ObjectNode body = base();
        body.remove("repository");
        body.put("action", action);
        body.with("installation").putObject("account").put("login", ACCOUNT).put("type", "Organization");
        return body;
    }

    private GitRepository connection(long externalId, String name, GitRepositoryStatus status, Long projectId) {
        return GitRepository.builder()
                .tenantId(tenantId).projectId(projectId).installationRef(installationRowId)
                .provider(GitProvider.GITHUB).externalId(externalId).ownerLogin(ACCOUNT).name(name)
                .fullName(ACCOUNT + "/" + name).htmlUrl("https://github.com/" + ACCOUNT + "/" + name)
                .visibility("private").defaultBranch("main").status(status)
                .linkedByUserId(1L).linkedAt(LocalDateTime.now()).build();
    }

    private void storeCommit(String sha) {
        commits.saveAndFlush(GitCommit.builder().tenantId(tenantId).projectId(masterId).repositoryId(connectionId)
                .repoExternalId(REPO).sha(sha).message("Work " + sha.charAt(0)).committedAt(LocalDateTime.now().minusHours(1))
                .firstSeenRef("refs/heads/main").source(GitCommitSource.WEBHOOK_PAYLOAD).ingestedEventId(1L)
                .ingestedAt(LocalDateTime.now()).bot(false).build());
    }

    private Long queueJob(Long repositoryId) {
        return jobs.saveAndFlush(GitSyncJob.builder().tenantId(tenantId).repositoryId(repositoryId).type(GitSyncJobType.MANUAL)
                .status(GitSyncJobStatus.PENDING).maxAttempts(3).nextRunAt(LocalDateTime.now().plusMinutes(10)).build()).getId();
    }

    private static GitHubRepository repo(long id, String name) {
        return new GitHubRepository(id, name, ACCOUNT + "/" + name, new GitHubRepository.Owner(ACCOUNT),
                "https://github.com/" + ACCOUNT + "/" + name, true, "private", "main", false, false);
    }

    private User person(Tenant tenant, String first, String permission) {
        User user = user(tenant, role("GI7-", permission));
        user.setFirstName(first);
        user.setLastName("Tester");
        return users.saveAndFlush(user);
    }

    /** Makes {@code user} a member of a new team of {@code projectId} with {@code role}. */
    private void joinTeamOf(Long projectId, User user, String role) {
        TrainingClass trainingClass = new TrainingClass();
        trainingClass.setCode("GI7-" + UUID.randomUUID());
        trainingClass.setName("GI-07 class");
        trainingClass.setTenantId(tenantId);
        trainingClass.setProgramId(1L);
        trainingClass.setStatus(TrainingClassStatus.ONGOING);
        classes.saveAndFlush(trainingClass);
        TeamAllocationSession session = new TeamAllocationSession();
        session.setTrainingClass(trainingClass);
        session.setMaxMembers(6);
        session.setStatus(TeamAllocationSessionStatus.PUBLISHED);
        allocationSessions.saveAndFlush(session);
        ProjectTeam team = new ProjectTeam();
        team.setTeamName("Team " + user.getFirstName());
        team.setTrainingClass(trainingClass);
        team.setAllocationSession(session);
        team.setMaxMembers(6);
        team.setStatus(ProjectTeamStatus.ACTIVE);
        team.setProject(projects.findById(projectId).orElseThrow());
        teams.saveAndFlush(team);
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
