package com.example.starter_project_2025.system.git_integration;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.git_integration.domain.GitIntegrationConnection;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubAccount;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.repository.GitIntegrationConnectionRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitIntegrationOAuthStateRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GitHubConnectIntegrationTest {

    private static final long INSTALLATION_ID = 987654L;

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
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired ProjectRepository projects;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired GitIntegrationConnectionRepository connections;
    @Autowired GitIntegrationOAuthStateRepository states;

    @MockBean GitHubApiClient github;

    Long projectId;
    Long otherProjectId;
    String managerToken;
    String otherManagerToken;
    String noPermissionToken;

    @BeforeEach
    void fixture() {
        // The in-memory test DB is shared by all tests of this class; installations are globally unique.
        connections.deleteAll();
        states.deleteAll();
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder()
                    .code("GIT-" + UUID.randomUUID()).name("Git test tenant").build());
            Role manager = role("GIT-MANAGER-", "GIT_INTEGRATION_MANAGE");
            Role nobody = role("GIT-NONE-");
            managerToken = token(user(tenant, manager));
            otherManagerToken = token(user(tenant, manager));
            noPermissionToken = token(user(tenant, nobody));
            projectId = project(tenant).getId();
            otherProjectId = project(tenant).getId();
        });
        when(github.exchangeCodeForUserToken("good-code")).thenReturn("user-token");
        when(github.getAuthenticatedUser("user-token")).thenReturn(new GitHubUser(42L, "octocat"));
        when(github.userCanAccessInstallation("user-token", INSTALLATION_ID)).thenReturn(true);
        when(github.getInstallation(INSTALLATION_ID)).thenReturn(Optional.of(new GitHubInstallation(
                INSTALLATION_ID, new GitHubAccount(7L, "my-org", "Organization"), 123L, "selected", null)));
    }

    @Test
    void ac01ConnectsAndStatusBecomesConnected() throws Exception {
        String state = startConnect(managerToken, projectId);

        callback(managerToken, Map.of("state", state, "code", "good-code",
                "installationId", INSTALLATION_ID, "setupAction", "install"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("CONNECTED"))
                .andExpect(jsonPath("$.connection.accountLogin").value("my-org"))
                .andExpect(jsonPath("$.connection.status").value("CONNECTED"));

        mvc.perform(get("/api/v1/projects/{id}/git-integration/github", projectId)
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONNECTED"))
                .andExpect(jsonPath("$.connections.length()").value(1));
        assertThat(projectConnections(projectId)).hasSize(1);
    }

    @Test
    void ac01ResponsesNeverExposeCredentials() throws Exception {
        String state = startConnect(managerToken, projectId);
        String body = callback(managerToken, Map.of("state", state, "code", "good-code",
                "installationId", INSTALLATION_ID)).andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("user-token").doesNotContain("good-code")
                .doesNotContain("test-secret").doesNotContain(state);
    }

    @Test
    void ac02DeniedAuthorizationCreatesNothing() throws Exception {
        String state = startConnect(managerToken, projectId);

        callback(managerToken, Map.of("state", state, "error", "access_denied",
                "errorDescription", "The user has denied your application access."))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_AUTHORIZATION_DENIED"));

        assertThat(projectConnections(projectId)).isEmpty();
        verify(github, never()).exchangeCodeForUserToken(anyString());
    }

    @Test
    void ac03UserWithoutPermissionIsForbiddenAndNothingIsCreated() throws Exception {
        long statesBefore = states.count();

        mvc.perform(post("/api/v1/projects/{id}/git-integration/github/connect", projectId)
                        .header("Authorization", "Bearer " + noPermissionToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects/{id}/git-integration/github", projectId)
                        .header("Authorization", "Bearer " + noPermissionToken))
                .andExpect(status().isForbidden());

        assertThat(states.count()).isEqualTo(statesBefore);
        assertThat(projectConnections(projectId)).isEmpty();
    }

    @Test
    void ac03UnauthenticatedRequestIsRejected() throws Exception {
        mvc.perform(post("/api/v1/projects/{id}/git-integration/github/connect", projectId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ac04UnknownStateIsRejected() throws Exception {
        callback(managerToken, Map.of("state", "forged-state", "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
        assertThat(projectConnections(projectId)).isEmpty();
    }

    @Test
    void ac04StateCannotBeReused() throws Exception {
        String state = startConnect(managerToken, projectId);
        Map<String, Object> body = Map.of("state", state, "code", "good-code", "installationId", INSTALLATION_ID);
        callback(managerToken, body).andExpect(status().isOk());

        callback(managerToken, body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
    }

    @Test
    void ac04ExpiredStateIsRejected() throws Exception {
        String state = startConnect(managerToken, projectId);
        tx.executeWithoutResult(status -> states.findAll().forEach(s -> s.setExpiresAt(LocalDateTime.now().minusMinutes(1))));

        callback(managerToken, Map.of("state", state, "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
        assertThat(projectConnections(projectId)).isEmpty();
    }

    @Test
    void ac04StateOfAnotherUserIsRejected() throws Exception {
        String state = startConnect(managerToken, projectId);

        callback(otherManagerToken, Map.of("state", state, "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));

        // The real owner can still finish: a foreign attempt must not burn the state.
        callback(managerToken, Map.of("state", state, "code", "good-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isOk());
    }

    @Test
    void ac04InstallationNotOwnedByUserIsRejected() throws Exception {
        long foreignInstallation = 111L;
        when(github.userCanAccessInstallation("user-token", foreignInstallation)).thenReturn(false);
        String state = startConnect(managerToken, projectId);

        callback(managerToken, Map.of("state", state, "code", "good-code", "installationId", foreignInstallation))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("GIT_INSTALLATION_NOT_OWNED"));

        assertThat(projectConnections(projectId)).isEmpty();
        verify(github, never()).getInstallation(eq(foreignInstallation));
    }

    @Test
    void ac04RejectedCodeIsReportedAsInvalidCallback() throws Exception {
        when(github.exchangeCodeForUserToken("bad-code"))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.REJECTED, "token exchange", 200));
        String state = startConnect(managerToken, projectId);

        callback(managerToken, Map.of("state", state, "code", "bad-code", "installationId", INSTALLATION_ID))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_CALLBACK_INVALID"));
        assertThat(projectConnections(projectId)).isEmpty();
    }

    @Test
    void ac05ReconnectUpdatesTheExistingRecord() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken, projectId), "code", "good-code",
                "installationId", INSTALLATION_ID)).andExpect(status().isOk());
        GitIntegrationConnection first = connections
                .findByProviderAndInstallationId(GitProvider.GITHUB, INSTALLATION_ID).orElseThrow();

        when(github.getInstallation(INSTALLATION_ID)).thenReturn(Optional.of(new GitHubInstallation(
                INSTALLATION_ID, new GitHubAccount(7L, "my-org-renamed", "Organization"), 123L, "all", null)));
        callback(otherManagerToken, Map.of("state", startConnect(otherManagerToken, projectId), "code", "good-code",
                "installationId", INSTALLATION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("RECONNECTED"))
                .andExpect(jsonPath("$.connection.id").value(first.getId()));

        List<GitIntegrationConnection> rows = projectConnections(projectId);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAccountLogin()).isEqualTo("my-org-renamed");
        assertThat(rows.get(0).getRepositorySelection()).isEqualTo("all");
        assertThat(rows.get(0).getConnectedAt()).isAfterOrEqualTo(first.getConnectedAt());
    }

    @Test
    void installationLinkedToAnotherProjectIsNotMoved() throws Exception {
        callback(managerToken, Map.of("state", startConnect(managerToken, projectId), "code", "good-code",
                "installationId", INSTALLATION_ID)).andExpect(status().isOk());

        callback(managerToken, Map.of("state", startConnect(managerToken, otherProjectId), "code", "good-code",
                "installationId", INSTALLATION_ID))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_INSTALLATION_LINKED_ELSEWHERE"));

        assertThat(projectConnections(projectId)).hasSize(1);
        assertThat(projectConnections(otherProjectId)).isEmpty();
    }

    @Test
    void organizationApprovalPendingReturnsAccepted() throws Exception {
        String state = startConnect(managerToken, projectId);

        callback(managerToken, Map.of("state", state, "code", "good-code", "setupAction", "request"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.outcome").value("PENDING_APPROVAL"));
        assertThat(projectConnections(projectId)).isEmpty();
        verify(github, never()).getInstallation(anyLong());
    }

    private String startConnect(String token, Long project) throws Exception {
        String body = mvc.perform(post("/api/v1/projects/{id}/git-integration/github/connect", project)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(body);
        String installUrl = node.get("installUrl").asText();
        assertThat(installUrl).startsWith("https://github.com/apps/test-app/installations/new?state=");
        return UriComponentsBuilder.fromUriString(installUrl).build().getQueryParams().getFirst("state");
    }

    private ResultActions callback(String token, Map<String, Object> body) throws Exception {
        return mvc.perform(post("/api/v1/git-integration/github/callback")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new HashMap<>(body))));
    }

    private List<GitIntegrationConnection> projectConnections(Long project) {
        return connections.findByProjectIdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(project, GitProvider.GITHUB);
    }

    private Role role(String prefix, String... permissionNames) {
        Role role = new Role();
        role.setName(prefix + UUID.randomUUID());
        role.setIsActive(true);
        Set<com.example.starter_project_2025.system.rbac.permission.Permission> granted = new HashSet<>();
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
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities()));
    }

    private Project project(Tenant tenant) {
        Project project = new Project();
        project.setCode("GIT-PRJ-" + UUID.randomUUID());
        project.setName("Git project");
        project.setTenant(tenant);
        project.setStatus(ProjectStatus.PLANNING);
        return projects.saveAndFlush(project);
    }
}
