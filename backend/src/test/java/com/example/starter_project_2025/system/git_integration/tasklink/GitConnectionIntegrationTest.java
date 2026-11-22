package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubAccount;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.sync.GitRepositorySyncRunner;
import com.example.starter_project_2025.system.notification.Notification;
import com.example.starter_project_2025.system.notification.NotificationRepository;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-GI-02 acceptance criteria: the GitHub connection status of a project (GitHub mocked). */
class GitConnectionIntegrationTest extends AbstractTaskLinkIntegrationTest {

    @Autowired GitRepositorySyncRunner runner;
    @Autowired InstallationTokenProvider installationTokens;
    @Autowired NotificationRepository notifications;

    Long installationRowId;

    @BeforeEach
    void connection() {
        installationTokens.invalidate(GITHUB_INSTALLATION_ID);
        installationRowId = connections.findById(connectionId).orElseThrow().getInstallationRef();
        // The person who connected the App is told about status changes.
        tx.executeWithoutResult(status -> installations.findById(installationRowId).orElseThrow().setConnectedByUserId(developerId));
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenReturn(new GitHubInstallationToken("ghs_meta", Instant.now().plusSeconds(3600)));
    }

    // ---- AC01 · Connected --------------------------------------------------------------------------------

    @Test
    void ac01AConnectedProjectShowsTheAccountAndNoSecret() throws Exception {
        String body = connection(readerToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONNECTED"))
                .andExpect(jsonPath("$.reason").doesNotExist())
                .andExpect(jsonPath("$.account.login").value("hcm26-java-team"))
                .andExpect(jsonPath("$.account.type").value("Organization"))
                .andExpect(jsonPath("$.account.manageUrl").value(
                        "https://github.com/organizations/hcm26-java-team/settings/installations/" + GITHUB_INSTALLATION_ID))
                .andExpect(jsonPath("$.repository.fullName").value("hcm26-java-team/webshop"))
                .andExpect(jsonPath("$.master.id").value(masterId))
                .andExpect(jsonPath("$.actions.canRecheck").value(false)) // a reader only looks
                .andReturn().getResponse().getContentAsString();
        assertThat(body.toLowerCase()).doesNotContain("token").doesNotContain("secret").doesNotContain("privatekey");

        connection(managerToken)
                .andExpect(jsonPath("$.actions.canRecheck").value(true))
                // Removing the App affects the whole account: not a project action (Git Integration page instead).
                .andExpect(jsonPath("$.actions.canDisconnect").doesNotExist())
                .andExpect(jsonPath("$.actions.canReconnect").value(false));
        // A module reads its master's connection.
        mvc.perform(get(url(moduleId)).header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$.status").value("CONNECTED"))
                .andExpect(jsonPath("$.inherited").value(true));
    }

    // ---- AC02 · Not connected ------------------------------------------------------------------------------

    @Test
    void ac02AProjectWithoutRepositoryIsDisconnectedAndOffersTheRightNextStep() throws Exception {
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.INACTIVE));

        connection(managerToken)
                .andExpect(jsonPath("$.status").value("DISCONNECTED"))
                .andExpect(jsonPath("$.reason").value("NOT_LINKED"))
                .andExpect(jsonPath("$.account").doesNotExist())
                .andExpect(jsonPath("$.otherConnectedAccounts").value(1))
                .andExpect(jsonPath("$.actions.canLinkRepository").value(true)) // the App is installed: link a repository
                .andExpect(jsonPath("$.actions.canConnect").value(false));

        tx.executeWithoutResult(status -> installations.findById(installationRowId).orElseThrow().setStatus(GitInstallationStatus.DISCONNECTED));
        connection(managerToken)
                .andExpect(jsonPath("$.actions.canConnect").value(true)) // nothing installed: Connect GitHub
                .andExpect(jsonPath("$.actions.canLinkRepository").value(false));
    }

    // ---- AC03 · Suspended or error ---------------------------------------------------------------------------

    @Test
    void ac03ASuspendEventMakesItSuspendedAndTellsWhoConnectedIt() throws Exception {
        deliverAndProcess("installation", installationEvent("suspend"));

        GitInstallation row = installations.findById(installationRowId).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(GitInstallationStatus.SUSPENDED);
        assertThat(row.getStatusReason()).isEqualTo("SUSPENDED_ON_GITHUB");
        assertThat(row.getStatusChangedAt()).isNotNull();
        connection(managerToken)
                .andExpect(jsonPath("$.status").value("SUSPENDED"))
                .andExpect(jsonPath("$.reason").value("SUSPENDED_ON_GITHUB"))
                .andExpect(jsonPath("$.since").isNotEmpty())
                .andExpect(jsonPath("$.actions.canReconnect").value(true));
        List<Notification> told = notifications.findTop30ByUser_IdOrderByCreatedAtDesc(developerId);
        assertThat(told).singleElement().satisfies(notification -> {
            assertThat(notification.getTitle()).isEqualTo("GitHub connection needs attention");
            assertThat(notification.getMessage()).contains("suspended").contains("hcm26-java-team");
        });

        deliverAndProcess("installation", installationEvent("unsuspend"));
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.CONNECTED);
        assertThat(notifications.findTop30ByUser_IdOrderByCreatedAtDesc(developerId)).hasSize(2); // "restored"
    }

    @Test
    void ac03ATokenRefusedWith404DuringASyncIsAnErrorAndTheRepositoryStays() throws Exception {
        Long jobId = queueJob();
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.GONE, "create installation token", 404));

        runner.run(jobId);

        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(jobs.findById(jobId).orElseThrow().getErrorCode()).isEqualTo("INSTALLATION_ERROR");
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.ERROR);
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
        connection(readerToken)
                .andExpect(jsonPath("$.status").value("ERROR"))
                .andExpect(jsonPath("$.reason").value("INSTALLATION_NOT_FOUND"));
        // A later sync does not even call GitHub while the connection is in error.
        Long next = queueJob();
        runner.run(next);
        assertThat(jobs.findById(next).orElseThrow().getErrorCode()).isEqualTo("INSTALLATION_ERROR");
    }

    @Test
    void ac03ARepeated401IsAnErrorButASingleOneIsRetried() {
        when(github.getRepository(anyString(), eq(REPO)))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.REJECTED, "get repository", 401));
        Long jobId = queueJob();

        runner.run(jobId); // maybe a stale cached token
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.CONNECTED);
        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.PENDING);

        makeDue(jobId);
        runner.run(jobId); // again with a fresh token
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.ERROR);
        assertThat(installations.findById(installationRowId).orElseThrow().getStatusReason()).isEqualTo("TOKEN_REJECTED");
        assertThat(jobs.findById(jobId).orElseThrow().getErrorCode()).isEqualTo("INSTALLATION_ERROR");
    }

    @Test
    void aTokenIssuedAgainClearsTheError() {
        setStatus(GitInstallationStatus.ERROR);

        installationTokens.token(GITHUB_INSTALLATION_ID);

        GitInstallation row = installations.findById(installationRowId).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(GitInstallationStatus.CONNECTED);
        assertThat(row.getStatusReason()).isEqualTo("TOKEN_ISSUED");
    }

    // ---- AC04 · Disconnect ---------------------------------------------------------------------------------

    @Test
    void ac04TheDeletedEventDisconnectsEvenFromErrorAndKeepsTheData() throws Exception {
        setStatus(GitInstallationStatus.ERROR);
        commits.saveAndFlush(GitCommit.builder().tenantId(tenantId).projectId(masterId).repositoryId(connectionId)
                .repoExternalId(REPO).sha("kept").message("kept").committedAt(LocalDateTime.now()).firstSeenRef("refs/heads/main")
                .source(GitCommitSource.WEBHOOK_PAYLOAD).ingestedEventId(1L).ingestedAt(LocalDateTime.now()).bot(false).build());

        deliverAndProcess("installation", installationEvent("deleted"));

        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.DISCONNECTED);
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.DISCONNECTED);
        assertThat(commits.countByRepositoryId(connectionId)).isEqualTo(1);
        connection(managerToken)
                .andExpect(jsonPath("$.status").value("DISCONNECTED"))
                .andExpect(jsonPath("$.reason").value("UNINSTALLED"))
                .andExpect(jsonPath("$.repository.status").value("DISCONNECTED"))
                .andExpect(jsonPath("$.actions.canReconnect").value(true));
    }

    // ---- Check again ---------------------------------------------------------------------------------------

    @Test
    void checkingAgainRestoresAWorkingInstallationOncePerCooldown() throws Exception {
        setStatus(GitInstallationStatus.ERROR);
        when(github.getInstallation(GITHUB_INSTALLATION_ID)).thenReturn(Optional.of(installation(null)));

        recheck(managerToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checked").value(true))
                .andExpect(jsonPath("$.connection.status").value("CONNECTED"))
                .andExpect(jsonPath("$.connection.lastCheckedAt").isNotEmpty());
        assertThat(installations.findById(installationRowId).orElseThrow().getStatusReason()).isEqualTo("RECHECK_OK");

        recheck(managerToken).andExpect(jsonPath("$.checked").value(false)); // within 30 seconds
        verify(github, times(1)).getInstallation(anyLong());
    }

    @Test
    void checkingAgainConfirmsARemovalOrASuspension() throws Exception {
        setStatus(GitInstallationStatus.ERROR);
        when(github.getInstallation(GITHUB_INSTALLATION_ID)).thenReturn(Optional.of(installation("2026-11-21T10:00:00Z")));
        recheck(managerToken).andExpect(jsonPath("$.connection.status").value("SUSPENDED"));

        clearCooldown();
        when(github.getInstallation(GITHUB_INSTALLATION_ID)).thenReturn(Optional.empty());
        recheck(managerToken)
                .andExpect(jsonPath("$.connection.status").value("DISCONNECTED"))
                .andExpect(jsonPath("$.connection.reason").value("UNINSTALLED"));
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.DISCONNECTED);
    }

    @Test
    void gitHubUnavailableDuringACheckChangesNothing() throws Exception {
        setStatus(GitInstallationStatus.ERROR);
        when(github.getInstallation(GITHUB_INSTALLATION_ID))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "get installation", 502));

        recheck(managerToken).andExpect(jsonPath("$.code").value("GIT_PROVIDER_UNAVAILABLE"));

        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.ERROR);
    }

    @Test
    void onlySomeoneWhoMayActCanCheckAgainAndManagersCanCheckAnInstallation() throws Exception {
        recheck(readerToken).andExpect(status().isForbidden());

        setStatus(GitInstallationStatus.ERROR);
        when(github.getInstallation(GITHUB_INSTALLATION_ID)).thenReturn(Optional.of(installation(null)));
        mvc.perform(post("/api/v1/git-integration/github/installations/" + installationRowId + "/recheck")
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONNECTED"))
                .andExpect(jsonPath("$.statusReason").value("RECHECK_OK"));
        mvc.perform(post("/api/v1/git-integration/github/installations/" + installationRowId + "/recheck")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void theInstallationListSummarizesAnError() throws Exception {
        setStatus(GitInstallationStatus.ERROR);

        mvc.perform(get("/api/v1/git-integration/github/installations").header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.status").value("ERROR"))
                .andExpect(jsonPath("$.installations[0].status").value("ERROR"));
    }

    @Test
    void theInstallationListNamesTheProjectsThatReadThroughIt() throws Exception {
        mvc.perform(get("/api/v1/git-integration/github/installations").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.installations[0].projects.length()").value(1))
                .andExpect(jsonPath("$.installations[0].projects[0].id").value(masterId))
                .andExpect(jsonPath("$.installations[0].projects[0].repositoryFullName").value("hcm26-java-team/webshop"))
                .andExpect(jsonPath("$.installations[0].projects[0].repositoryStatus").value("ACTIVE"));

        // An unlinked repository no longer ties its project to the installation.
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.INACTIVE));
        mvc.perform(get("/api/v1/git-integration/github/installations").header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.installations[0].projects.length()").value(0));
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private String url(Long projectId) {
        return "/api/v1/git-integration/projects/" + projectId + "/github/connection";
    }

    private ResultActions connection(String token) throws Exception {
        return mvc.perform(get(url(masterId)).header("Authorization", "Bearer " + token));
    }

    private ResultActions recheck(String token) throws Exception {
        return mvc.perform(post(url(masterId) + "/recheck").header("Authorization", "Bearer " + token));
    }

    private ObjectNode installationEvent(String action) {
        ObjectNode body = base();
        body.remove("repository");
        body.put("action", action);
        return body;
    }

    private void setStatus(GitInstallationStatus status) {
        tx.executeWithoutResult(t -> installations.findById(installationRowId).orElseThrow().setStatus(status));
    }

    private void clearCooldown() {
        tx.executeWithoutResult(t -> installations.findById(installationRowId).orElseThrow().setLastCheckedAt(null));
    }

    private Long queueJob() {
        return jobs.saveAndFlush(GitSyncJob.builder().tenantId(tenantId).repositoryId(connectionId).type(GitSyncJobType.MANUAL)
                .status(GitSyncJobStatus.PENDING).maxAttempts(3).nextRunAt(LocalDateTime.now().minusSeconds(1)).build()).getId();
    }

    private void makeDue(Long jobId) {
        tx.executeWithoutResult(t -> jobs.findById(jobId).orElseThrow().setNextRunAt(LocalDateTime.now().minusSeconds(1)));
    }

    private static GitHubInstallation installation(String suspendedAt) {
        return new GitHubInstallation(GITHUB_INSTALLATION_ID, new GitHubAccount(1L, "hcm26-java-team", "Organization"),
                123L, "selected", suspendedAt);
    }
}
