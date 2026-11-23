package com.example.starter_project_2025.system.git_integration;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.git_integration.config.GitInstallationLegacyMigration;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubAccount;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitOAuthStateRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.security.KeyPairGenerator;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** GI-01 acceptance criteria against the real web, security and persistence layers (GitHub mocked). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GitInstallationIntegrationTest {

    private static final long INSTALLATION_ID = 987654L;
    private static final long SECOND_INSTALLATION_ID = 123123L;
    private static final String BASE = "/api/v1/git-integration/github";

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
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired GitInstallationRepository installations;
    @Autowired GitOAuthStateRepository states;
    @Autowired GitInstallationLegacyMigration legacyMigration;

    @MockBean GitHubApiClient github;

    Long tenantId;
    Long otherTenantId;
    String managerToken;
    String secondManagerToken;
    String readerToken;
    String noPermissionToken;
    String otherTenantManagerToken;

    @BeforeEach
    void fixture() {
        // The in-memory test DB is shared by the tests of this class; installations are globally unique.
        installations.deleteAll();
        states.deleteAll();
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("GIT-" + UUID.randomUUID()).name("Git tenant").build());
            Tenant other = tenants.saveAndFlush(Tenant.builder().code("GIT-O-" + UUID.randomUUID()).name("Other tenant").build());
            tenantId = tenant.getId();
            otherTenantId = other.getId();
            Role manager = role("GIT-MANAGER-", "GIT_INTEGRATION_MANAGE");
            Role reader = role("GIT-READER-", "GIT_INTEGRATION_READ");
            Role nobody = role("GIT-NONE-");
            managerToken = token(user(tenant, manager));
            secondManagerToken = token(user(tenant, manager));
            readerToken = token(user(tenant, reader));
            noPermissionToken = token(user(tenant, nobody));
            otherTenantManagerToken = token(user(other, manager));
        });
        when(github.exchangeCodeForUserToken("good-code")).thenReturn("user-token");
        when(github.getAuthenticatedUser("user-token")).thenReturn(new GitHubUser(42L, "octocat"));
        when(github.userCanAccessInstallation(eq("user-token"), anyLong())).thenReturn(true);
        when(github.getInstallation(INSTALLATION_ID)).thenReturn(Optional.of(installation(INSTALLATION_ID, "my-org", "Organization", "selected", null)));
        when(github.getInstallation(SECOND_INSTALLATION_ID)).thenReturn(Optional.of(installation(SECOND_INSTALLATION_ID, "octocat", "User", "all", null)));
    }

    // ---- AC01 · T1 ----------------------------------------------------------------------------------

    @Test
    void ac01ConnectStoresInstallationForTenantWithoutProject() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code",
                "installationId", INSTALLATION_ID, "setupAction", "install"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("CONNECTED"))
                .andExpect(jsonPath("$.installation.accountLogin").value("my-org"))
                .andExpect(jsonPath("$.installation.status").value("CONNECTED"))
                .andExpect(jsonPath("$.installation.projectId").doesNotExist());

        mvc.perform(get(BASE + "/installations").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONNECTED"))
                .andExpect(jsonPath("$.canManage").value(true))
                .andExpect(jsonPath("$.installations.length()").value(1));
        assertThat(tenantRows()).singleElement().satisfies(row -> assertThat(row.getTenantId()).isEqualTo(tenantId));
    }

    @Test
    void t2SuspendedInstallationIsStoredAsSuspended() throws Exception {
        when(github.getInstallation(INSTALLATION_ID))
                .thenReturn(Optional.of(installation(INSTALLATION_ID, "my-org", "Organization", "selected", "2026-11-01T00:00:00Z")));

        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.installation.status").value("SUSPENDED"));
        mvc.perform(get(BASE + "/installations").header("Authorization", "Bearer " + managerToken))
                .andExpect(jsonPath("$.status").value("SUSPENDED"));
    }

    @Test
    void reconnectedAccountIsListedOnceWithItsNewInstallation() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isOk());
        markDisconnected(INSTALLATION_ID);
        // Reinstalling the app on the same account gives a new installation id for the same GitHub account.
        long reinstalled = 555777L;
        when(github.getInstallation(reinstalled)).thenReturn(Optional.of(new GitHubInstallation(reinstalled,
                new GitHubAccount(INSTALLATION_ID + 1000, "my-org", "Organization"), 123L, "selected", null)));
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", reinstalled))
                .andExpect(status().isOk());

        mvc.perform(get(BASE + "/installations").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONNECTED"))
                .andExpect(jsonPath("$.installations.length()").value(1))
                .andExpect(jsonPath("$.installations[0].installationId").value(reinstalled))
                .andExpect(jsonPath("$.installations[0].status").value("CONNECTED"));
        assertThat(tenantRows()).hasSize(2);
    }

    @Test
    void disconnectedAccountStaysListedUntilItIsReconnected() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isOk());
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", SECOND_INSTALLATION_ID))
                .andExpect(status().isOk());
        markDisconnected(INSTALLATION_ID);

        mvc.perform(get(BASE + "/installations").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.installations.length()").value(2))
                .andExpect(jsonPath("$.installations[?(@.installationId == " + INSTALLATION_ID + ")].status").value("DISCONNECTED"));
    }

    @Test
    void responsesNeverExposeCredentials() throws Exception {
        String state = startConnect(managerToken);
        String body = callback(managerToken, Map.of("state", state, "code", "good-code", "installationId", INSTALLATION_ID))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("user-token").doesNotContain("good-code").doesNotContain("test-secret").doesNotContain(state);
    }

    @Test
    void severalInstallationsPerTenant() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isOk());
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", SECOND_INSTALLATION_ID))
                .andExpect(status().isOk());

        assertThat(tenantRows()).extracting(GitInstallation::getAccountLogin).containsExactlyInAnyOrder("my-org", "octocat");
    }

    // ---- AC02 ----------------------------------------------------------------------------------------

    @Test
    void ac02DeniedAuthorizationCreatesNothing() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken), "error", "access_denied"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_AUTHORIZATION_DENIED"));

        assertThat(tenantRows()).isEmpty();
        verify(github, never()).exchangeCodeForUserToken(anyString());
    }

    // ---- AC03 ----------------------------------------------------------------------------------------

    @Test
    void ac03WithoutPermissionNothingIsCreated() throws Exception {
        long statesBefore = states.count();

        mvc.perform(post(BASE + "/connect").header("Authorization", "Bearer " + noPermissionToken))
                .andExpect(status().isForbidden());
        mvc.perform(get(BASE + "/installations").header("Authorization", "Bearer " + noPermissionToken))
                .andExpect(status().isForbidden());

        assertThat(states.count()).isEqualTo(statesBefore);
        assertThat(tenantRows()).isEmpty();
    }

    @Test
    void ac03ReaderCanListButNotConnect() throws Exception {
        mvc.perform(get(BASE + "/installations").header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canManage").value(false))
                .andExpect(jsonPath("$.status").value("NOT_CONNECTED"));
        mvc.perform(post(BASE + "/connect").header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void ac03UnauthenticatedRequestIsRejected() throws Exception {
        mvc.perform(post(BASE + "/connect")).andExpect(status().isUnauthorized());
    }

    // ---- AC04 ----------------------------------------------------------------------------------------

    @Test
    void ac04UnknownStateIsRejected() throws Exception {
        callback(managerToken, Map.of("state", "forged-state", "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
        assertThat(tenantRows()).isEmpty();
    }

    @Test
    void ac04StateCannotBeReused() throws Exception {
        Map<String, Object> body = Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", INSTALLATION_ID);
        callback(managerToken, body).andExpect(status().isOk());

        callback(managerToken, body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
    }

    @Test
    void ac04ExpiredStateIsRejected() throws Exception {
        String state = startConnect(managerToken);
        tx.executeWithoutResult(status -> states.findAll().forEach(s -> s.setExpiresAt(LocalDateTime.now().minusMinutes(1))));

        callback(managerToken, Map.of("state", state, "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
        assertThat(tenantRows()).isEmpty();
    }

    @Test
    void ac04StateOfAnotherUserIsRejectedAndNotBurnt() throws Exception {
        String state = startConnect(managerToken);

        callback(secondManagerToken, Map.of("state", state, "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
        callback(managerToken, Map.of("state", state, "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isOk());
    }

    @Test
    void ac04StateIssuedForAnotherTenantIsRejected() throws Exception {
        String state = startConnect(managerToken);
        tx.executeWithoutResult(status -> states.findAll().forEach(s -> s.setTenantId(otherTenantId)));

        callback(managerToken, Map.of("state", state, "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
        assertThat(tenantRows()).isEmpty();
    }

    @Test
    void ac04InstallationNotOwnedByUserIsRejected() throws Exception {
        long foreign = 111L;
        when(github.userCanAccessInstallation("user-token", foreign)).thenReturn(false);

        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", foreign))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("GIT_INSTALLATION_NOT_OWNED"));
        assertThat(tenantRows()).isEmpty();
        verify(github, never()).getInstallation(eq(foreign));
    }

    @Test
    void ac04RejectedCodeIsReportedAsInvalidCallback() throws Exception {
        when(github.exchangeCodeForUserToken("bad-code"))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.REJECTED, "token exchange", 200));

        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "bad-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_CALLBACK_INVALID"));
        assertThat(tenantRows()).isEmpty();
    }

    // ---- AC05 · T3 / T4 ------------------------------------------------------------------------------

    @Test
    void ac05ReconnectBySameTenantUpdatesTheExistingRow() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isOk());
        GitInstallation first = installations.findByProviderAndInstallationId(GitProvider.GITHUB, INSTALLATION_ID).orElseThrow();

        when(github.getInstallation(INSTALLATION_ID))
                .thenReturn(Optional.of(installation(INSTALLATION_ID, "my-org-renamed", "Organization", "all", null)));
        callback(secondManagerToken, Map.of("state", startConnect(secondManagerToken), "code", "good-code",
                "installationId", INSTALLATION_ID, "setupAction", "update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("RECONNECTED"))
                .andExpect(jsonPath("$.installation.id").value(first.getId()));

        assertThat(tenantRows()).singleElement().satisfies(row -> {
            assertThat(row.getAccountLogin()).isEqualTo("my-org-renamed");
            assertThat(row.getRepositorySelection()).isEqualTo("all");
            assertThat(row.getConnectedAt()).isAfterOrEqualTo(first.getConnectedAt());
        });
    }

    @Test
    void t4ReconnectAfterUnsuspendBecomesConnected() throws Exception {
        when(github.getInstallation(INSTALLATION_ID))
                .thenReturn(Optional.of(installation(INSTALLATION_ID, "my-org", "Organization", "selected", "2026-11-01T00:00:00Z")));
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(jsonPath("$.installation.status").value("SUSPENDED"));

        when(github.getInstallation(INSTALLATION_ID))
                .thenReturn(Optional.of(installation(INSTALLATION_ID, "my-org", "Organization", "selected", null)));
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(jsonPath("$.outcome").value("RECONNECTED"))
                .andExpect(jsonPath("$.installation.status").value("CONNECTED"));
        assertThat(tenantRows()).hasSize(1);
    }

    @Test
    void installationHeldByAnotherTenantIsNotTakenOver() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isOk());

        callback(otherTenantManagerToken, Map.of("state", startConnect(otherTenantManagerToken), "code", "good-code",
                "installationId", INSTALLATION_ID))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_INSTALLATION_LINKED_ELSEWHERE"));

        assertThat(tenantRows()).singleElement().satisfies(row -> assertThat(row.getTenantId()).isEqualTo(tenantId));
        mvc.perform(get(BASE + "/installations").header("Authorization", "Bearer " + otherTenantManagerToken))
                .andExpect(jsonPath("$.installations.length()").value(0));
    }

    @Test
    void organizationApprovalPendingReturnsAcceptedAndStoresNothing() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken), "code", "good-code", "setupAction", "request"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.outcome").value("PENDING_APPROVAL"));
        assertThat(tenantRows()).isEmpty();
        verify(github, never()).getInstallation(anyLong());
    }

    // ---- Legacy project-bound tables -----------------------------------------------------------------

    @Test
    void legacyProjectBoundRowsMoveToInstallationsAndOldTablesAreDropped() throws Exception {
        jdbc.execute("""
                CREATE TABLE git_integration_connections (id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id BIGINT NOT NULL,
                  project_id BIGINT NOT NULL, provider VARCHAR(20) NOT NULL, installation_id BIGINT NOT NULL,
                  account_id BIGINT NOT NULL, account_login VARCHAR(100) NOT NULL, account_type VARCHAR(20) NOT NULL,
                  repository_selection VARCHAR(20), status VARCHAR(20) NOT NULL, connected_by_user_id BIGINT NOT NULL,
                  github_user_id BIGINT, github_user_login VARCHAR(100), connected_at TIMESTAMP NOT NULL,
                  last_verified_at TIMESTAMP NOT NULL, version BIGINT, is_active BOOLEAN NOT NULL,
                  created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, created_by BIGINT, updated_by BIGINT)""");
        jdbc.execute("CREATE TABLE git_integration_oauth_states (id BIGINT PRIMARY KEY, project_id BIGINT NOT NULL)");
        jdbc.update("""
                INSERT INTO git_integration_connections (tenant_id, project_id, provider, installation_id, account_id, account_login,
                  account_type, repository_selection, status, connected_by_user_id, connected_at, last_verified_at, version,
                  is_active, created_at, updated_at)
                VALUES (?, 1, 'GITHUB', 555, 9, 'legacy-org', 'Organization', 'all', 'CONNECTED', 1,
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""", tenantId);

        assertThat(legacyMigration.migrate()).isEqualTo(1);
        assertThat(legacyMigration.migrate()).isZero();

        assertThat(installations.findByProviderAndInstallationId(GitProvider.GITHUB, 555L)).hasValueSatisfying(row -> {
            assertThat(row.getTenantId()).isEqualTo(tenantId);
            assertThat(row.getAccountLogin()).isEqualTo("legacy-org");
        });
        Integer legacyTables = jdbc.queryForObject("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                 WHERE TABLE_NAME IN ('GIT_INTEGRATION_CONNECTIONS', 'GIT_INTEGRATION_OAUTH_STATES')""", Integer.class);
        assertThat(legacyTables).isZero();
    }

    // ---- helpers -------------------------------------------------------------------------------------

    private static GitHubInstallation installation(long id, String login, String type, String selection, String suspendedAt) {
        return new GitHubInstallation(id, new GitHubAccount(id + 1000, login, type), 123L, selection, suspendedAt);
    }

    private String startConnect(String token) throws Exception {
        String body = mvc.perform(post(BASE + "/connect").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String installUrl = json.readTree(body).get("installUrl").asText();
        assertThat(installUrl).startsWith("https://github.com/apps/test-app/installations/new?state=");
        return UriComponentsBuilder.fromUriString(installUrl).build().getQueryParams().getFirst("state");
    }

    private ResultActions callback(String token, Map<String, Object> body) throws Exception {
        return mvc.perform(post(BASE + "/callback")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new HashMap<>(body))));
    }

    private void markDisconnected(long installationId) {
        GitInstallation row = installations.findByProviderAndInstallationId(GitProvider.GITHUB, installationId).orElseThrow();
        row.setStatus(GitInstallationStatus.DISCONNECTED);
        installations.saveAndFlush(row);
    }

    private List<GitInstallation> tenantRows() {
        return installations.findByTenantIdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(tenantId, GitProvider.GITHUB);
    }

    private Role role(String prefix, String... permissionNames) {
        Role role = new Role();
        role.setName(prefix + UUID.randomUUID());
        role.setIsActive(true);
        Set<Permission> granted = new HashSet<>();
        for (String name : permissionNames) {
            granted.add(permissions.findByName(name).orElseThrow());
        }
        role.setPermissions(granted);
        return roles.saveAndFlush(role);
    }

    private User user(Tenant tenant, Role role) {
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@git.test");
        user.setFirstName("Git");
        user.setLastName("Tester");
        user.setUserCode("GIT-" + UUID.randomUUID());
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
