package com.example.starter_project_2025.system.git_integration;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.GitHubGraphQlClient;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranch;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.service.InstallationRepositoryCache;
import com.example.starter_project_2025.system.git_integration.sync.GitRepositorySyncRunner;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.KeyPairGenerator;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-GI-04 acceptance criteria through the real web, security and persistence layers (GitHub mocked). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GitRepositoryLinkIntegrationTest {

    private static final long GITHUB_INSTALLATION_ID = 778899L;
    private static final long REPO_ECOMMERCE = 101L;
    private static final long REPO_OTHER = 102L;
    private static final long REPO_USED_BY_B = 103L;
    private static final long REPO_ARCHIVED = 104L;

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
        // Jobs are run explicitly by the tests.
        registry.add("app.github.sync-dispatch-enabled", () -> "false");
        registry.add("app.github.sync-poller-enabled", () -> "false");
    }

    @Autowired MockMvc mvc;
    @Autowired TransactionTemplate tx;
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired ProjectRepository projects;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired GitInstallationRepository installations;
    @Autowired GitRepositoryRepository connections;
    @Autowired GitSyncJobRepository jobs;
    @Autowired InstallationRepositoryCache cache;
    @Autowired InstallationTokenProvider installationTokens;
    @Autowired GitRepositorySyncRunner runner;

    @MockBean GitHubApiClient github;
    @MockBean GitHubGraphQlClient graphql;

    Long tenantId;
    Long installationRowId;
    Long otherTenantInstallationRowId;
    Long masterId;
    Long moduleId;
    Long masterBId;
    Long completedMasterId;
    String managerToken;
    String readerToken;
    String noPermissionToken;

    @BeforeEach
    void fixture() {
        jobs.deleteAll();
        connections.deleteAll();
        installations.deleteAll();
        cache.evict(GITHUB_INSTALLATION_ID);
        installationTokens.invalidate(GITHUB_INSTALLATION_ID);
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("GI4-" + UUID.randomUUID()).name("GI-04 tenant").build());
            Tenant other = tenants.saveAndFlush(Tenant.builder().code("GI4-O-" + UUID.randomUUID()).name("Other").build());
            tenantId = tenant.getId();
            managerToken = token(user(tenant, role("GI4-MANAGE-", "GIT_INTEGRATION_MANAGE")));
            readerToken = token(user(tenant, role("GI4-READ-", "GIT_INTEGRATION_READ")));
            noPermissionToken = token(user(tenant, role("GI4-NONE-")));

            Project master = project(tenant, "PRJ-A", "E-commerce platform", null, ProjectStatus.PLANNING);
            masterId = master.getId();
            moduleId = project(tenant, "PRJ-A-M1", "Payment module", master, ProjectStatus.PLANNING).getId();
            project(tenant, "PRJ-A-M2", "Catalog module", master, ProjectStatus.PLANNING);
            masterBId = project(tenant, "PRJ-B", "Team B project", null, ProjectStatus.ACTIVE).getId();
            completedMasterId = project(tenant, "PRJ-OLD", "Finished project", null, ProjectStatus.COMPLETED).getId();

            installationRowId = installation(tenant.getId(), GITHUB_INSTALLATION_ID, GitInstallationStatus.CONNECTED).getId();
            otherTenantInstallationRowId = installation(other.getId(), 990011L, GitInstallationStatus.CONNECTED).getId();

            // REPO_USED_BY_B is already ACTIVE on master project B.
            connections.saveAndFlush(GitRepository.builder()
                    .tenantId(tenant.getId()).projectId(masterBId).installationRef(installationRowId)
                    .provider(GitProvider.GITHUB).externalId(REPO_USED_BY_B).ownerLogin("hcm26-java-team").name("team-b-api")
                    .fullName("hcm26-java-team/team-b-api").htmlUrl("https://github.com/hcm26-java-team/team-b-api")
                    .visibility("private").defaultBranch("develop").status(GitRepositoryStatus.ACTIVE)
                    .linkedByUserId(1L).linkedAt(LocalDateTime.now()).build());
        });
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenReturn(new GitHubInstallationToken("ghs_test", Instant.now().plusSeconds(3600)));
        when(github.getRepository(anyString(), anyLong())).thenReturn(Optional.empty());
        when(github.getRepository(anyString(), eq(REPO_ECOMMERCE))).thenReturn(Optional.of(repo(REPO_ECOMMERCE, "ecommerce", false)));
        when(github.getRepository(anyString(), eq(REPO_OTHER))).thenReturn(Optional.of(repo(REPO_OTHER, "other", false)));
        when(github.getRepository(anyString(), eq(REPO_USED_BY_B))).thenReturn(Optional.of(repo(REPO_USED_BY_B, "team-b-api", false)));
        when(github.getRepository(anyString(), eq(REPO_ARCHIVED))).thenReturn(Optional.of(repo(REPO_ARCHIVED, "old-demo", true)));
        when(github.listBranches(anyString(), anyString(), anyString(), eq(1)))
                .thenReturn(List.of(new GitHubBranch("main", true), new GitHubBranch("develop", false)));
        // SY-01: the commit step (covered by CommitHistorySyncIntegrationTest) finds an empty history.
        when(github.createContentsToken(GITHUB_INSTALLATION_ID))
                .thenReturn(new GitHubInstallationToken("ghs_contents", Instant.now().plusSeconds(3600)));
        when(graphql.commitHistory(anyString(), anyString(), anyString(), any(), any(), anyInt()))
                .thenReturn(new GitHubCommitHistoryPage(true, false, "main", "abc", List.of(), false, null, 0, null));
        when(graphql.pullRequests(anyString(), anyString(), anyString(), any(), anyInt(), anyInt()))
                .thenReturn(new GitHubPullRequestPage(true, false, List.of(), false, null, 0, null));
    }

    // ---- AC01 ----------------------------------------------------------------------------------------

    @Test
    void ac01LinksRepositoryAsActiveWithGitHubMetadataAndQueuesInitialSync() throws Exception {
        link(managerToken, masterId, installationRowId, REPO_ECOMMERCE)
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.inherited").value(false))
                .andExpect(jsonPath("$.repository.externalId").value(REPO_ECOMMERCE))
                .andExpect(jsonPath("$.repository.fullName").value("hcm26-java-team/ecommerce"))
                .andExpect(jsonPath("$.repository.status").value("ACTIVE"))
                .andExpect(jsonPath("$.latestSync.type").value("INITIAL"))
                .andExpect(jsonPath("$.latestSync.status").value("PENDING"))
                .andExpect(jsonPath("$.canLink").value(false));

        GitRepository row = connections.findFirstByProjectIdAndStatus(masterId, GitRepositoryStatus.ACTIVE).orElseThrow();
        // Owner, name, URL and default branch come from GitHub, not from the request.
        assertThat(row.getOwnerLogin()).isEqualTo("hcm26-java-team");
        assertThat(row.getName()).isEqualTo("ecommerce");
        assertThat(row.getHtmlUrl()).isEqualTo("https://github.com/hcm26-java-team/ecommerce");
        assertThat(row.getDefaultBranch()).isEqualTo("main");
        assertThat(row.getInstallationRef()).isEqualTo(installationRowId);
        assertThat(row.getActiveProjectId()).isEqualTo(masterId);
        assertThat(row.getActiveExternalId()).isEqualTo(REPO_ECOMMERCE);

        GitSyncJob job = jobs.findFirstByRepositoryIdOrderByIdDesc(row.getId()).orElseThrow();
        assertThat(job.getType()).isEqualTo(GitSyncJobType.INITIAL);
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
    }

    @Test
    void ac01InitialSyncRefreshesSnapshotAndCountsBranches() throws Exception {
        link(managerToken, masterId, installationRowId, REPO_ECOMMERCE).andExpect(status().isCreated());
        GitRepository row = connections.findFirstByProjectIdAndStatus(masterId, GitRepositoryStatus.ACTIVE).orElseThrow();
        Long jobId = jobs.findFirstByRepositoryIdOrderByIdDesc(row.getId()).orElseThrow().getId();
        // Renamed on GitHub between link and sync: the snapshot follows the stable id.
        when(github.getRepository(anyString(), eq(REPO_ECOMMERCE))).thenReturn(Optional.of(repo(REPO_ECOMMERCE, "ecommerce-v2", false)));

        runner.run(jobId);

        GitSyncJob job = jobs.findById(jobId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.SUCCEEDED);
        assertThat(job.getAttemptCount()).isEqualTo(1);
        assertThat(job.getStatsJson()).contains("\"branches\":2");
        GitRepository synced = connections.findById(row.getId()).orElseThrow();
        assertThat(synced.getName()).isEqualTo("ecommerce-v2");
        assertThat(synced.getLastSyncedAt()).isNotNull();

        view(managerToken, masterId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latestSync.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.latestSync.stats.branches").value(2))
                .andExpect(jsonPath("$.repository.lastSyncedAt").isNotEmpty())
                .andExpect(jsonPath("$.masterProject.moduleCount").value(2));
    }

    @Test
    void linkingTheSameRepositoryAgainIsIdempotent() throws Exception {
        link(managerToken, masterId, installationRowId, REPO_ECOMMERCE).andExpect(status().isCreated());
        long rows = connections.count();
        long queued = jobs.count();

        link(managerToken, masterId, installationRowId, REPO_ECOMMERCE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repository.externalId").value(REPO_ECOMMERCE));
        assertThat(connections.count()).isEqualTo(rows);
        assertThat(jobs.count()).isEqualTo(queued);
    }

    // ---- AC02 ----------------------------------------------------------------------------------------

    @Test
    void ac02SecondRepositoryOnTheSameMasterIsRejected() throws Exception {
        link(managerToken, masterId, installationRowId, REPO_ECOMMERCE).andExpect(status().isCreated());
        long rows = connections.count();

        link(managerToken, masterId, installationRowId, REPO_OTHER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_ALREADY_LINKED"))
                .andExpect(jsonPath("$.details.repository.fullName").value("hcm26-java-team/ecommerce"));
        assertThat(connections.count()).isEqualTo(rows);
    }

    // ---- AC03 ----------------------------------------------------------------------------------------

    @Test
    void ac03RepositoryActiveOnAnotherMasterIsRejected() throws Exception {
        link(managerToken, masterId, installationRowId, REPO_USED_BY_B)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_REPOSITORY_IN_USE"))
                .andExpect(jsonPath("$.details.linkedProject.code").value("PRJ-B"));
        assertThat(connections.findFirstByProjectIdAndStatus(masterId, GitRepositoryStatus.ACTIVE)).isEmpty();
    }

    // ---- AC04 ----------------------------------------------------------------------------------------

    @Test
    void ac04RepositoryTheAppCannotAccessIsRejectedAndNothingIsWritten() throws Exception {
        long rows = connections.count();
        link(managerToken, masterId, installationRowId, 555L)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_REPOSITORY_NOT_ACCESSIBLE"));
        assertThat(connections.count()).isEqualTo(rows);
        assertThat(jobs.count()).isZero();
    }

    @Test
    void ac04ATokenRefusedWith404PutsTheInstallationInError() throws Exception {
        // GI-02: a 404 for the token is ERROR; only the "deleted" webhook or "Check again" confirms DISCONNECTED.
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.GONE, "create installation token", 404));

        link(managerToken, masterId, installationRowId, REPO_ECOMMERCE)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_INSTALLATION_ERROR"))
                .andExpect(jsonPath("$.installationStatus").value("ERROR"));
        GitInstallation row = installations.findById(installationRowId).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(GitInstallationStatus.ERROR);
        assertThat(row.getStatusReason()).isEqualTo("INSTALLATION_NOT_FOUND");
    }

    @Test
    void inactiveInstallationIsRejectedWithoutCallingGitHub() throws Exception {
        tx.executeWithoutResult(status -> installations.findById(installationRowId).orElseThrow().setStatus(GitInstallationStatus.SUSPENDED));

        link(managerToken, masterId, installationRowId, REPO_ECOMMERCE)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_INSTALLATION_NOT_ACTIVE"));
        verify(github, never()).createInstallationToken(anyLong());
    }

    // ---- AC05 ----------------------------------------------------------------------------------------

    @Test
    void ac05LinkingFromAModuleIsRejected() throws Exception {
        link(managerToken, moduleId, installationRowId, REPO_ECOMMERCE)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_NOT_MASTER"))
                .andExpect(jsonPath("$.details.masterProject.id").value(masterId))
                .andExpect(jsonPath("$.details.masterProject.code").value("PRJ-A"));
        assertThat(jobs.count()).isZero();
        verify(github, never()).getRepository(anyString(), anyLong());
    }

    @Test
    void moduleSharesTheMasterRepository() throws Exception {
        view(managerToken, moduleId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inherited").value(true))
                .andExpect(jsonPath("$.project.master").value(false))
                .andExpect(jsonPath("$.masterProject.id").value(masterId))
                .andExpect(jsonPath("$.repository").doesNotExist())
                .andExpect(jsonPath("$.canLink").value(false));

        link(managerToken, masterId, installationRowId, REPO_ECOMMERCE).andExpect(status().isCreated());

        view(managerToken, moduleId)
                .andExpect(jsonPath("$.inherited").value(true))
                .andExpect(jsonPath("$.repository.fullName").value("hcm26-java-team/ecommerce"))
                .andExpect(jsonPath("$.canLink").value(false));
    }

    // ---- Other rules ---------------------------------------------------------------------------------

    @Test
    void masterThatHasEndedCannotBeLinked() throws Exception {
        link(managerToken, completedMasterId, installationRowId, REPO_ECOMMERCE)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_NOT_LINKABLE"));
        view(managerToken, completedMasterId).andExpect(jsonPath("$.canLink").value(false));
    }

    @Test
    void archivedRepositoryIsRejected() throws Exception {
        link(managerToken, masterId, installationRowId, REPO_ARCHIVED)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_REPOSITORY_ARCHIVED"));
    }

    @Test
    void installationOfAnotherTenantIsNotFound() throws Exception {
        link(managerToken, masterId, otherTenantInstallationRowId, REPO_ECOMMERCE)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_INSTALLATION_NOT_FOUND"));
    }

    @Test
    void unknownProjectIsNotFound() throws Exception {
        link(managerToken, 987654321L, installationRowId, REPO_ECOMMERCE)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_NOT_FOUND"));
    }

    @Test
    void readersCanViewButNotLink() throws Exception {
        view(readerToken, masterId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canLink").value(false));
        link(readerToken, masterId, installationRowId, REPO_ECOMMERCE)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("GIT_INTEGRATION_FORBIDDEN"));
        view(managerToken, masterId).andExpect(jsonPath("$.canLink").value(true));
    }

    @Test
    void userWithoutAnyAccessIsForbidden() throws Exception {
        view(noPermissionToken, masterId).andExpect(status().isForbidden());
        link(noPermissionToken, masterId, installationRowId, REPO_ECOMMERCE).andExpect(status().isForbidden());
    }

    @Test
    void missingFieldsReturnFieldKeyedErrors() throws Exception {
        mvc.perform(post(url(masterId)).header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"installationId\": " + installationRowId + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_REQUEST_INVALID"))
                .andExpect(jsonPath("$.errors.externalId").exists());
    }

    // ---- Uniqueness and concurrency ------------------------------------------------------------------

    @Test
    void databaseRejectsTwoActiveConnectionsForTheSameRepository() {
        assertThatThrownBy(() -> connections.saveAndFlush(GitRepository.builder()
                .tenantId(tenantId).projectId(masterId).installationRef(installationRowId)
                .provider(GitProvider.GITHUB).externalId(REPO_USED_BY_B).ownerLogin("o").name("n").fullName("o/n")
                .htmlUrl("https://github.com/o/n").visibility("private").status(GitRepositoryStatus.ACTIVE)
                .linkedByUserId(1L).linkedAt(LocalDateTime.now()).build()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void inactiveHistoryDoesNotBlockLinking() throws Exception {
        tx.executeWithoutResult(status -> connections.findFirstByProjectIdAndStatus(masterBId, GitRepositoryStatus.ACTIVE)
                .orElseThrow().setStatus(GitRepositoryStatus.INACTIVE));

        link(managerToken, masterId, installationRowId, REPO_USED_BY_B).andExpect(status().isCreated());
        assertThat(connections.findAll()).filteredOn(row -> row.getExternalId() == REPO_USED_BY_B).hasSize(2);
    }

    @Test
    void concurrentLinksToTheSameMasterLetOnlyOneWin() throws Exception {
        List<Integer> statuses = race(
                () -> link(managerToken, masterId, installationRowId, REPO_ECOMMERCE).andReturn().getResponse().getStatus(),
                () -> link(managerToken, masterId, installationRowId, REPO_OTHER).andReturn().getResponse().getStatus());
        assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        assertThat(connections.findAll()).filteredOn(row -> masterId.equals(row.getProjectId())).hasSize(1);
    }

    @Test
    void concurrentLinksOfTheSameRepositoryLetOnlyOneWin() throws Exception {
        Long masterC = tx.execute(status -> project(tenants.findById(tenantId).orElseThrow(), "PRJ-C", "Team C", null,
                ProjectStatus.PLANNING).getId());
        List<Integer> statuses = race(
                () -> link(managerToken, masterId, installationRowId, REPO_ECOMMERCE).andReturn().getResponse().getStatus(),
                () -> link(managerToken, masterC, installationRowId, REPO_ECOMMERCE).andReturn().getResponse().getStatus());
        assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        assertThat(connections.findAll()).filteredOn(row -> row.getExternalId() == REPO_ECOMMERCE).hasSize(1);
    }

    // ---- Synchronization -----------------------------------------------------------------------------

    @Test
    void syncFindingTheRepositoryGoneMarksItInErrorUntilItIsUnlinked() throws Exception {
        Long jobId = linkAndGetJob();
        when(github.getRepository(anyString(), eq(REPO_ECOMMERCE))).thenReturn(Optional.empty());

        runner.run(jobId);

        assertThat(jobs.findById(jobId).orElseThrow().getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(jobs.findById(jobId).orElseThrow().getErrorCode()).isEqualTo("REPOSITORY_NOT_ACCESSIBLE");
        // GI-05: ERROR keeps the repository on the master; changing it is "unlink, then link".
        String body = view(managerToken, masterId)
                .andExpect(jsonPath("$.repository.status").value("ERROR"))
                .andExpect(jsonPath("$.repository.statusReason").value("REPOSITORY_NOT_ACCESSIBLE"))
                .andExpect(jsonPath("$.canLink").value(false))
                .andExpect(jsonPath("$.canResync").value(true))
                .andExpect(jsonPath("$.canUnlink").value(true))
                .andReturn().getResponse().getContentAsString();
        link(managerToken, masterId, installationRowId, REPO_OTHER)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_ALREADY_LINKED"));

        Long repositoryId = ((Number) com.jayway.jsonpath.JsonPath.read(body, "$.repository.id")).longValue();
        mvc.perform(post(url(masterId) + "/unlink").header("Authorization", "Bearer " + managerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"repositoryId\": " + repositoryId + "}"))
                .andExpect(status().isOk());
        link(managerToken, masterId, installationRowId, REPO_OTHER).andExpect(status().isCreated());
    }

    @Test
    void transientFailuresAreRetriedThenGiveUpAndCanBeRetriedManually() throws Exception {
        Long jobId = linkAndGetJob();
        when(github.listBranches(anyString(), anyString(), anyString(), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "list branches", 503));

        runner.run(jobId);
        GitSyncJob afterFirst = jobs.findById(jobId).orElseThrow();
        assertThat(afterFirst.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(afterFirst.getAttemptCount()).isEqualTo(1);
        assertThat(afterFirst.getNextRunAt()).isAfter(LocalDateTime.now());
        assertThat(afterFirst.getErrorCode()).isEqualTo("PROVIDER_UNAVAILABLE");

        runner.run(jobId); // not due yet: nothing happens
        assertThat(jobs.findById(jobId).orElseThrow().getAttemptCount()).isEqualTo(1);

        makeDue(jobId);
        runner.run(jobId);
        makeDue(jobId);
        runner.run(jobId);
        GitSyncJob failed = jobs.findById(jobId).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(failed.getAttemptCount()).isEqualTo(3);
        // GI-05: a sync that gave up puts the repository in ERROR; "Sync again" checks GitHub and restores it.
        view(managerToken, masterId)
                .andExpect(jsonPath("$.repository.status").value("ERROR"))
                .andExpect(jsonPath("$.repository.statusReason").value("SYNC_FAILED"))
                .andExpect(jsonPath("$.canSync").value(false))
                .andExpect(jsonPath("$.canResync").value(true));

        mvc.perform(post(url(masterId) + "/sync").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.id").value(jobId))
                .andExpect(jsonPath("$.type").value("INITIAL"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.attemptCount").value(0));
        // Clicking again while it waits queues nothing new.
        mvc.perform(post(url(masterId) + "/sync").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(jobId));
        assertThat(jobs.count()).isEqualTo(1);
    }

    @Test
    void rateLimitPostponesWithoutCountingTheAttempt() throws Exception {
        Long jobId = linkAndGetJob();
        when(github.listBranches(anyString(), anyString(), anyString(), anyInt()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.RATE_LIMITED, "list branches", 403, 120L));

        runner.run(jobId);

        GitSyncJob job = jobs.findById(jobId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.PENDING);
        assertThat(job.getAttemptCount()).isZero();
        assertThat(job.getNextRunAt()).isAfter(LocalDateTime.now().plusSeconds(60));
    }

    @Test
    void retryFromAModuleIsRejected() throws Exception {
        mvc.perform(post(url(moduleId) + "/sync").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_NOT_MASTER"));
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private Long linkAndGetJob() throws Exception {
        link(managerToken, masterId, installationRowId, REPO_ECOMMERCE).andExpect(status().isCreated());
        GitRepository row = connections.findFirstByProjectIdAndStatus(masterId, GitRepositoryStatus.ACTIVE).orElseThrow();
        return jobs.findFirstByRepositoryIdOrderByIdDesc(row.getId()).orElseThrow().getId();
    }

    private void makeDue(Long jobId) {
        tx.executeWithoutResult(status -> jobs.findById(jobId).orElseThrow().setNextRunAt(LocalDateTime.now().minusSeconds(1)));
    }

    private List<Integer> race(Callable<Integer> first, Callable<Integer> second) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Integer>> futures = new ArrayList<>();
            for (Callable<Integer> call : List.of(first, second)) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return call.call();
                }));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : futures) statuses.add(future.get());
            return statuses;
        } finally {
            pool.shutdownNow();
        }
    }

    private static String url(Long projectId) {
        return "/api/v1/git-integration/projects/" + projectId + "/repository";
    }

    private ResultActions link(String token, Long projectId, Long installationId, long externalId) throws Exception {
        return mvc.perform(post(url(projectId)).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"installationId\": " + installationId + ", \"externalId\": " + externalId + "}"));
    }

    private ResultActions view(String token, Long projectId) throws Exception {
        return mvc.perform(get(url(projectId)).header("Authorization", "Bearer " + token));
    }

    private static GitHubRepository repo(long id, String name, boolean archived) {
        return new GitHubRepository(id, name, "hcm26-java-team/" + name, new GitHubRepository.Owner("hcm26-java-team"),
                "https://github.com/hcm26-java-team/" + name, true, "private", "main", archived, false);
    }

    private GitInstallation installation(Long tenantId, long githubId, GitInstallationStatus status) {
        return installations.saveAndFlush(GitInstallation.builder()
                .tenantId(tenantId).provider(GitProvider.GITHUB).installationId(githubId)
                .accountId(githubId).accountLogin("hcm26-java-team").accountType("Organization").repositorySelection("selected")
                .status(status).connectedByUserId(1L)
                .connectedAt(LocalDateTime.now()).lastVerifiedAt(LocalDateTime.now()).build());
    }

    private Project project(Tenant tenant, String code, String name, Project parent, ProjectStatus status) {
        Project project = new Project();
        project.setCode(code + "-" + UUID.randomUUID());
        project.setName(name);
        project.setTenant(tenant);
        project.setStatus(status);
        project.setParentProject(parent);
        Project saved = projects.saveAndFlush(project);
        saved.setCode(code); // keep the visible code short for assertions (unique per tenant)
        return projects.saveAndFlush(saved);
    }

    private Role role(String prefix, String... permissionNames) {
        Role role = new Role();
        role.setName(prefix + UUID.randomUUID());
        role.setIsActive(true);
        Set<Permission> granted = new HashSet<>();
        for (String name : permissionNames) granted.add(permissions.findByName(name).orElseThrow());
        role.setPermissions(granted);
        return roles.saveAndFlush(role);
    }

    private User user(Tenant tenant, Role role) {
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@gi4.test");
        user.setFirstName("Git");
        user.setLastName("Linker");
        user.setUserCode("GI4-" + UUID.randomUUID());
        user.setPasswordHash("unused-test-password");
        user.setTenant(tenant);
        user.setRoles(new HashSet<>(Set.of(role)));
        return users.saveAndFlush(user);
    }

    private String token(User user) {
        var principal = userDetails.loadUserByUsername(user.getEmail());
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
}
