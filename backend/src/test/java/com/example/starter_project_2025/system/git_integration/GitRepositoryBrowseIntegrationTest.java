package com.example.starter_project_2025.system.git_integration;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationRepositoriesPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.service.InstallationRepositoryCache;
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
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-GI-03 acceptance criteria through the real web, security and persistence layers (GitHub mocked). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GitRepositoryBrowseIntegrationTest {

    private static final long GITHUB_INSTALLATION_ID = 445566L;

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
    @Autowired TransactionTemplate tx;
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired ProjectRepository projects;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired GitInstallationRepository installations;
    @Autowired GitRepositoryRepository repositoryConnections;
    @Autowired InstallationRepositoryCache cache;

    @MockBean GitHubApiClient github;

    Long installationRowId;
    Long linkedProjectId;
    Long otherProjectId;
    String readerToken;
    String noPermissionToken;
    String otherTenantToken;

    @BeforeEach
    void fixture() {
        repositoryConnections.deleteAll();
        installations.deleteAll();
        cache.evict(GITHUB_INSTALLATION_ID);
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("GI3-" + UUID.randomUUID()).name("GI-03 tenant").build());
            Tenant other = tenants.saveAndFlush(Tenant.builder().code("GI3-O-" + UUID.randomUUID()).name("Other").build());
            readerToken = token(user(tenant, role("GI3-READ-", "GIT_INTEGRATION_READ")));
            noPermissionToken = token(user(tenant, role("GI3-NONE-")));
            otherTenantToken = token(user(other, role("GI3-OTHER-", "GIT_INTEGRATION_MANAGE")));
            linkedProjectId = project(tenant, "PRJ-B", "Team B").getId();
            otherProjectId = project(tenant, "PRJ-C", "Team C").getId();
            installationRowId = installations.saveAndFlush(GitInstallation.builder()
                    .tenantId(tenant.getId()).provider(GitProvider.GITHUB).installationId(GITHUB_INSTALLATION_ID)
                    .accountId(1L).accountLogin("hcm26-java-team").accountType("Organization").repositorySelection("selected")
                    .status(GitInstallationStatus.CONNECTED).connectedByUserId(1L)
                    .connectedAt(LocalDateTime.now()).lastVerifiedAt(LocalDateTime.now()).build()).getId();
            // Repository 2 already has an ACTIVE connection to project B.
            repositoryConnections.saveAndFlush(GitRepository.builder()
                    .tenantId(tenant.getId()).projectId(linkedProjectId).installationRef(installationRowId)
                    .provider(GitProvider.GITHUB).externalId(2L).ownerLogin("hcm26-java-team").name("team-b-api")
                    .fullName("hcm26-java-team/team-b-api").htmlUrl("https://github.com/hcm26-java-team/team-b-api")
                    .visibility("private").defaultBranch("develop").status(GitRepositoryStatus.ACTIVE)
                    .linkedByUserId(1L).linkedAt(LocalDateTime.now()).build());
        });
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenReturn(new GitHubInstallationToken("ghs_test", Instant.now().plusSeconds(3600)));
        when(github.listInstallationRepositories(anyString(), eq(1))).thenReturn(new GitHubInstallationRepositoriesPage(4, List.of(
                repo(1, "fams-backend", "private", "main", false),
                repo(2, "team-b-api", "private", "develop", false),
                repo(3, "landing-page", "public", "master", false),
                repo(4, "old-demo", "public", "main", true))));
    }

    // ---- AC01 ----------------------------------------------------------------------------------------

    @Test
    void ac01ListsAccessibleRepositoriesWithRequiredFields() throws Exception {
        browse(readerToken, "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.installation.accountLogin").value("hcm26-java-team"))
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.counts.all").value(4))
                .andExpect(jsonPath("$.counts.available").value(2))
                .andExpect(jsonPath("$.counts.linked").value(1))
                // Selectable repositories first, then by full name.
                .andExpect(jsonPath("$.items[*].name", contains("fams-backend", "landing-page", "old-demo", "team-b-api")))
                .andExpect(jsonPath("$.items[0].owner").value("hcm26-java-team"))
                .andExpect(jsonPath("$.items[0].htmlUrl").value("https://github.com/hcm26-java-team/fams-backend"))
                .andExpect(jsonPath("$.items[0].visibility").value("private"))
                .andExpect(jsonPath("$.items[0].defaultBranch").value("main"))
                .andExpect(jsonPath("$.items[0].selectable").value(true));
    }

    @Test
    void repositoryLinkedToAnotherProjectIsMarkedAndNotSelectable() throws Exception {
        browse(readerToken, "&filter=linked")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].name").value("team-b-api"))
                .andExpect(jsonPath("$.items[0].selectable").value(false))
                .andExpect(jsonPath("$.items[0].unavailableReason").value("LINKED_TO_OTHER_PROJECT"))
                .andExpect(jsonPath("$.items[0].linkedProject.code").value("PRJ-B"));

        browse(readerToken, "&filter=linked&projectId=" + linkedProjectId)
                .andExpect(jsonPath("$.items[0].unavailableReason").value("LINKED_TO_THIS_PROJECT"));
    }

    @Test
    void archivedRepositoryIsShownButNotSelectable() throws Exception {
        browse(readerToken, "&q=old-demo")
                .andExpect(jsonPath("$.items[0].archived").value(true))
                .andExpect(jsonPath("$.items[0].selectable").value(false))
                .andExpect(jsonPath("$.items[0].unavailableReason").value("ARCHIVED"));
    }

    @Test
    void browsingNeverCreatesRepositoryConnections() throws Exception {
        long before = repositoryConnections.count();
        browse(readerToken, "").andExpect(status().isOk());
        assertThat(repositoryConnections.count()).isEqualTo(before);
    }

    // ---- AC02 ----------------------------------------------------------------------------------------

    @Test
    void ac02NoRepositoryGrantedReturnsEmptyPage() throws Exception {
        when(github.listInstallationRepositories(anyString(), eq(1))).thenReturn(new GitHubInstallationRepositoriesPage(0, List.of()));

        browse(readerToken, "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.counts.all").value(0))
                .andExpect(jsonPath("$.totalPages").value(0));
    }

    // ---- AC03 ----------------------------------------------------------------------------------------

    @Test
    void ac03SearchFiltersCaseInsensitivelyAndPages() throws Exception {
        browse(readerToken, "&q=PAGE")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].name").value("landing-page"))
                .andExpect(jsonPath("$.counts.all").value(1));

        browse(readerToken, "&filter=available&size=1&page=1")
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.items[0].name").value("landing-page"));
    }

    @Test
    void searchAndPagingReuseTheCachedListAndRefreshRefetches() throws Exception {
        browse(readerToken, "").andExpect(jsonPath("$.fromCache").value(false));
        browse(readerToken, "&q=fams").andExpect(jsonPath("$.fromCache").value(true));
        browse(readerToken, "&page=1&size=2").andExpect(jsonPath("$.fromCache").value(true));
        verify(github, times(1)).listInstallationRepositories(anyString(), anyInt());

        browse(readerToken, "&refresh=true").andExpect(jsonPath("$.fromCache").value(false));
        verify(github, times(2)).listInstallationRepositories(anyString(), anyInt());
    }

    // ---- AC04 ----------------------------------------------------------------------------------------

    @Test
    void ac04GitHubUnavailableReturns502AndCreatesNothing() throws Exception {
        when(github.listInstallationRepositories(anyString(), eq(1)))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "list", 503));
        long before = repositoryConnections.count();

        browse(readerToken, "")
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("GIT_PROVIDER_UNAVAILABLE"));
        assertThat(repositoryConnections.count()).isEqualTo(before);
    }

    @Test
    void ac04RateLimitReturns429WithRetryAfter() throws Exception {
        when(github.listInstallationRepositories(anyString(), eq(1)))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.RATE_LIMITED, "list", 403, 120L));

        browse(readerToken, "")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "120"))
                .andExpect(jsonPath("$.code").value("GIT_RATE_LIMITED"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(120));
    }

    // ---- Installation state (T5 / T6) ----------------------------------------------------------------

    @Test
    void uninstalledAppMarksInstallationDisconnected() throws Exception {
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.GONE, "token", 404));

        browse(readerToken, "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_INSTALLATION_NOT_ACTIVE"))
                .andExpect(jsonPath("$.installationStatus").value("DISCONNECTED"));
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.DISCONNECTED);
    }

    @Test
    void suspendedAppMarksInstallationSuspended() throws Exception {
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.SUSPENDED, "token", 403));

        browse(readerToken, "").andExpect(jsonPath("$.installationStatus").value("SUSPENDED"));
        assertThat(installations.findById(installationRowId).orElseThrow().getStatus()).isEqualTo(GitInstallationStatus.SUSPENDED);
    }

    @Test
    void inactiveInstallationIsRejectedWithoutCallingGitHub() throws Exception {
        tx.executeWithoutResult(status -> installations.findById(installationRowId).orElseThrow()
                .setStatus(GitInstallationStatus.SUSPENDED));

        browse(readerToken, "").andExpect(status().isConflict());
        verify(github, never()).createInstallationToken(anyLong());
    }

    // ---- Access ----------------------------------------------------------------------------------------

    @Test
    void installationOfAnotherTenantIsNotFound() throws Exception {
        browse(otherTenantToken, "")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_INSTALLATION_NOT_FOUND"));
    }

    @Test
    void userWithoutPermissionIsForbidden() throws Exception {
        browse(noPermissionToken, "").andExpect(status().isForbidden());
    }

    // ---- helpers ---------------------------------------------------------------------------------------

    private ResultActions browse(String token, String query) throws Exception {
        return mvc.perform(get("/api/v1/git-integration/github/installations/" + installationRowId + "/repositories?x=1" + query)
                .header("Authorization", "Bearer " + token));
    }

    private static GitHubRepository repo(long id, String name, String visibility, String branch, boolean archived) {
        return new GitHubRepository(id, name, "hcm26-java-team/" + name, new GitHubRepository.Owner("hcm26-java-team"),
                "https://github.com/hcm26-java-team/" + name, "private".equals(visibility), visibility, branch, archived, false);
    }

    private Project project(Tenant tenant, String code, String name) {
        Project project = new Project();
        project.setCode(code + "-" + UUID.randomUUID());
        project.setName(name);
        project.setTenant(tenant);
        project.setStatus(ProjectStatus.PLANNING);
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
        user.setEmail(UUID.randomUUID() + "@gi3.test");
        user.setFirstName("Git");
        user.setLastName("Browser");
        user.setUserCode("GI3-" + UUID.randomUUID());
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
