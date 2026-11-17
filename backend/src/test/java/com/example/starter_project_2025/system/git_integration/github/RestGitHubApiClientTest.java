package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppCredentials;
import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class RestGitHubApiClientTest {

    private KeyPair keyPair;
    private GitHubAppProperties properties;
    private MockRestServiceServer server;
    private RestGitHubApiClient client;
    private GitHubAppJwtFactory jwtFactory;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        keyPair = generator.generateKeyPair();

        properties = new GitHubAppProperties();
        properties.setEnabled(true);
        properties.setAppId("123");
        properties.setAppSlug("test-app");
        properties.setClientId("Iv1.test");
        properties.setClientSecret("test-secret");
        properties.setCallbackUrl("http://localhost:5173/git-integration/github/callback");
        properties.setPrivateKey("-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder().encodeToString(keyPair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----");

        Clock clock = Clock.fixed(Instant.now(), ZoneOffset.UTC);
        jwtFactory = new GitHubAppJwtFactory(properties, new GitHubAppCredentials(properties), clock);
        RestClient.Builder builder = RestClient.builder().baseUrl(properties.getApiBaseUrl());
        server = MockRestServiceServer.bindTo(builder).build();
        client = new RestGitHubApiClient(builder.build(), properties, jwtFactory);
    }

    @Test
    void exchangesCodeOnGithubDotComWithFormBody() {
        server.expect(requestTo("https://github.com/login/oauth/access_token"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().formDataContains(java.util.Map.of(
                        "client_id", "Iv1.test", "client_secret", "test-secret", "code", "abc",
                        "redirect_uri", "http://localhost:5173/git-integration/github/callback")))
                .andRespond(withSuccess("{\"access_token\":\"ghu_x\",\"token_type\":\"bearer\"}",
                        MediaType.APPLICATION_JSON));

        assertThat(client.exchangeCodeForUserToken("abc")).isEqualTo("ghu_x");
        server.verify();
    }

    @Test
    void tokenEndpointErrorWithHttp200IsRejected() {
        server.expect(requestTo("https://github.com/login/oauth/access_token"))
                .andRespond(withSuccess("{\"error\":\"bad_verification_code\"}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.exchangeCodeForUserToken("expired"))
                .isInstanceOf(GitHubApiException.class)
                .satisfies(e -> assertThat(((GitHubApiException) e).getKind()).isEqualTo(GitHubApiException.Kind.REJECTED))
                .hasMessageNotContaining("expired")
                .hasMessageNotContaining("bad_verification_code");
    }

    @Test
    void findsInstallationOnSecondPage() {
        server.expect(requestTo("https://api.github.com/user/installations?per_page=100&page=1"))
                .andExpect(header("Authorization", "Bearer ghu_x"))
                .andRespond(withSuccess("{\"total_count\":101,\"installations\":[{\"id\":1}]}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/user/installations?per_page=100&page=2"))
                .andRespond(withSuccess("{\"total_count\":101,\"installations\":[{\"id\":555}]}", MediaType.APPLICATION_JSON));

        assertThat(client.userCanAccessInstallation("ghu_x", 555L)).isTrue();
        server.verify();
    }

    @Test
    void installationMissingFromUserListIsNotOwned() {
        server.expect(requestTo("https://api.github.com/user/installations?per_page=100&page=1"))
                .andRespond(withSuccess("{\"total_count\":1,\"installations\":[{\"id\":1}]}", MediaType.APPLICATION_JSON));

        assertThat(client.userCanAccessInstallation("ghu_x", 555L)).isFalse();
    }

    @Test
    void getInstallationUsesSignedAppJwt() {
        server.expect(requestTo("https://api.github.com/app/installations/555"))
                .andExpect(request -> {
                    String auth = request.getHeaders().getFirst("Authorization");
                    assertThat(auth).startsWith("Bearer ");
                    Claims claims = Jwts.parserBuilder().setSigningKey(keyPair.getPublic()).build()
                            .parseClaimsJws(auth.substring(7)).getBody();
                    assertThat(claims.getIssuer()).isEqualTo("123");
                    long lifetime = claims.getExpiration().getTime() - claims.getIssuedAt().getTime();
                    assertThat(lifetime).isLessThanOrEqualTo(600_000L);
                })
                .andRespond(withSuccess("""
                        {"id":555,"app_id":123,"repository_selection":"selected","suspended_at":null,
                         "account":{"id":7,"login":"my-org","type":"Organization"}}""", MediaType.APPLICATION_JSON));

        var installation = client.getInstallation(555L).orElseThrow();
        assertThat(installation.account().login()).isEqualTo("my-org");
        assertThat(installation.repositorySelection()).isEqualTo("selected");
        assertThat(installation.suspended()).isFalse();
    }

    @Test
    void unknownInstallationReturnsEmpty() {
        server.expect(requestTo("https://api.github.com/app/installations/999"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND).body("{\"message\":\"Not Found\"}"));

        assertThat(client.getInstallation(999L)).isEmpty();
    }

    @Test
    void serverErrorIsUnavailableAndDoesNotLeakBody() {
        server.expect(requestTo("https://api.github.com/user"))
                .andRespond(withServerError().body("internal secret detail"));

        assertThatThrownBy(() -> client.getAuthenticatedUser("ghu_x"))
                .isInstanceOf(GitHubApiException.class)
                .satisfies(e -> assertThat(((GitHubApiException) e).getKind()).isEqualTo(GitHubApiException.Kind.UNAVAILABLE))
                .hasMessageNotContaining("internal secret detail")
                .hasMessageNotContaining("ghu_x");
    }

    // ---- US-GI-03 ------------------------------------------------------------------------------------

    @Test
    void createsReadOnlyInstallationTokenWithAppJwt() {
        server.expect(requestTo("https://api.github.com/app/installations/555/access_tokens"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(request -> assertThat(request.getHeaders().getFirst("Authorization")).startsWith("Bearer ey"))
                .andExpect(content().json("{\"permissions\":{\"metadata\":\"read\"}}"))
                .andRespond(withStatus(HttpStatus.CREATED).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"token\":\"ghs_secret\",\"expires_at\":\"2030-01-01T00:00:00Z\"}"));

        var token = client.createInstallationToken(555L);
        assertThat(token.token()).isEqualTo("ghs_secret");
        assertThat(token.toString()).doesNotContain("ghs_secret");
        server.verify();
    }

    @Test
    void uninstalledInstallationIsGone() {
        server.expect(requestTo("https://api.github.com/app/installations/555/access_tokens"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND).body("{\"message\":\"Not Found\"}"));

        assertThatThrownBy(() -> client.createInstallationToken(555L))
                .isInstanceOf(GitHubApiException.class)
                .satisfies(e -> assertThat(((GitHubApiException) e).getKind()).isEqualTo(GitHubApiException.Kind.GONE));
    }

    @Test
    void suspendedInstallationIsReportedWithoutLeakingBody() {
        server.expect(requestTo("https://api.github.com/app/installations/555/access_tokens"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"message\":\"This installation has been suspended\"}"));

        assertThatThrownBy(() -> client.createInstallationToken(555L))
                .isInstanceOf(GitHubApiException.class)
                .satisfies(e -> assertThat(((GitHubApiException) e).getKind()).isEqualTo(GitHubApiException.Kind.SUSPENDED))
                .hasMessageNotContaining("suspended\"");
    }

    @Test
    void listsInstallationRepositoriesWithInstallationToken() {
        server.expect(requestTo("https://api.github.com/installation/repositories?per_page=100&page=2"))
                .andExpect(header("Authorization", "Bearer ghs_secret"))
                .andRespond(withSuccess("""
                        {"total_count":101,"repositories":[{"id":9,"name":"api","full_name":"org/api",
                         "owner":{"login":"org"},"html_url":"https://github.com/org/api","private":true,
                         "visibility":"private","default_branch":"main","archived":false,"disabled":false}]}""",
                        MediaType.APPLICATION_JSON));

        var page = client.listInstallationRepositories("ghs_secret", 2);
        assertThat(page.totalCount()).isEqualTo(101);
        assertThat(page.repositories()).singleElement().satisfies(repo -> {
            assertThat(repo.fullName()).isEqualTo("org/api");
            assertThat(repo.ownerLogin()).isEqualTo("org");
            assertThat(repo.resolvedVisibility()).isEqualTo("private");
            assertThat(repo.defaultBranch()).isEqualTo("main");
        });
    }

    @Test
    void primaryRateLimitCarriesRetryAfter() {
        long reset = java.time.Instant.now().getEpochSecond() + 120;
        server.expect(requestTo("https://api.github.com/installation/repositories?per_page=100&page=1"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN)
                        .header("x-ratelimit-remaining", "0")
                        .header("x-ratelimit-reset", String.valueOf(reset)));

        assertThatThrownBy(() -> client.listInstallationRepositories("ghs_secret", 1))
                .isInstanceOf(GitHubApiException.class)
                .satisfies(e -> {
                    GitHubApiException api = (GitHubApiException) e;
                    assertThat(api.getKind()).isEqualTo(GitHubApiException.Kind.RATE_LIMITED);
                    assertThat(api.getRetryAfterSeconds()).isBetween(100L, 121L);
                })
                .hasMessageNotContaining("ghs_secret");
    }

    @Test
    void secondaryRateLimitUsesRetryAfterHeader() {
        server.expect(requestTo("https://api.github.com/installation/repositories?per_page=100&page=1"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).header("retry-after", "30"));

        assertThatThrownBy(() -> client.listInstallationRepositories("ghs_secret", 1))
                .satisfies(e -> assertThat(((GitHubApiException) e).getRetryAfterSeconds()).isEqualTo(30L));
    }

    // ---- GI-04 -------------------------------------------------------------------------------------

    @Test
    void getsRepositoryByStableNumericId() {
        server.expect(requestTo("https://api.github.com/repositories/812345678"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer ghs_secret"))
                .andRespond(withSuccess("""
                        {"id":812345678,"name":"ecommerce","full_name":"hcm26-java-team/ecommerce",
                         "owner":{"login":"hcm26-java-team"},"html_url":"https://github.com/hcm26-java-team/ecommerce",
                         "private":true,"visibility":"private","default_branch":"main","archived":false,"disabled":false}
                        """, MediaType.APPLICATION_JSON));

        var repository = client.getRepository("ghs_secret", 812345678L).orElseThrow();
        assertThat(repository.fullName()).isEqualTo("hcm26-java-team/ecommerce");
        assertThat(repository.ownerLogin()).isEqualTo("hcm26-java-team");
        assertThat(repository.defaultBranch()).isEqualTo("main");
        server.verify();
    }

    @Test
    void repositoryTheInstallationCannotSeeIsEmpty() {
        server.expect(requestTo("https://api.github.com/repositories/1"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND).body("{\"message\":\"Not Found\"}"));
        server.expect(requestTo("https://api.github.com/repositories/2"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).body("{\"message\":\"Resource not accessible by integration\"}"));

        assertThat(client.getRepository("ghs_secret", 1L)).isEmpty();
        assertThat(client.getRepository("ghs_secret", 2L)).isEmpty();
    }

    @Test
    void rateLimitedRepositoryReadIsNotMistakenForNoAccess() {
        server.expect(requestTo("https://api.github.com/repositories/1"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).header("x-ratelimit-remaining", "0"));

        assertThatThrownBy(() -> client.getRepository("ghs_secret", 1L))
                .satisfies(e -> assertThat(((GitHubApiException) e).getKind()).isEqualTo(GitHubApiException.Kind.RATE_LIMITED));
    }

    @Test
    void listsBranchesPage() {
        server.expect(requestTo("https://api.github.com/repos/hcm26-java-team/ecommerce/branches?per_page=100&page=1"))
                .andExpect(header("Authorization", "Bearer ghs_secret"))
                .andRespond(withSuccess("[{\"name\":\"main\",\"protected\":true},{\"name\":\"develop\",\"protected\":false}]",
                        MediaType.APPLICATION_JSON));

        var branches = client.listBranches("ghs_secret", "hcm26-java-team", "ecommerce", 1);
        assertThat(branches).extracting("name").containsExactly("main", "develop");
        assertThat(branches.get(0).protectedBranch()).isTrue();
    }

    // ---- SY-04 ----------------------------------------------------------------------------------

    @Test
    void contentsTokenAsksForReadOnlyMetadataAndContents() {
        server.expect(requestTo("https://api.github.com/app/installations/42/access_tokens"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json("{\"permissions\":{\"metadata\":\"read\",\"contents\":\"read\"}}", true))
                .andRespond(withSuccess("{\"token\":\"ghs_c\",\"expires_at\":\"2030-01-01T00:00:00Z\"}", MediaType.APPLICATION_JSON));

        assertThat(client.createContentsToken(42).token()).isEqualTo("ghs_c");
        server.verify();
    }

    @Test
    void comparesCommitsPageByPage() {
        server.expect(requestTo("https://api.github.com/repos/hcm26/shop/compare/aaa...bbb?per_page=100&page=2"))
                .andExpect(header("Authorization", "Bearer ghs_c"))
                .andRespond(withSuccess("""
                        {"status":"ahead","ahead_by":101,"total_commits":101,"commits":[
                          {"sha":"c101","html_url":"https://github.com/hcm26/shop/commit/c101",
                           "commit":{"message":"feat: x","author":{"name":"A","email":"a@x.io","date":"2026-11-17T03:00:00Z"},
                                     "committer":{"name":"A","email":"a@x.io","date":"2026-11-17T03:00:00Z"}},
                           "author":{"login":"dev-a","id":7},"committer":null,"parents":[{"sha":"c100"}]}]}""",
                        MediaType.APPLICATION_JSON));

        var result = client.compareCommits("ghs_c", "hcm26", "shop", "aaa", "bbb", 2);

        assertThat(result.totalCommits()).isEqualTo(101);
        assertThat(result.commits()).singleElement().satisfies(commit -> {
            assertThat(commit.sha()).isEqualTo("c101");
            assertThat(commit.author().login()).isEqualTo("dev-a");
            assertThat(commit.commit().committer().date()).isEqualTo("2026-11-17T03:00:00Z");
            assertThat(commit.parents()).hasSize(1);
        });
        server.verify();
    }

    @Test
    void listsCommitsAndReportsRateLimits() {
        server.expect(requestTo("https://api.github.com/repos/hcm26/shop/commits?sha=bbb&per_page=100&page=1"))
                .andRespond(withSuccess("[{\"sha\":\"c1\"},{\"sha\":\"c2\"}]", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/repos/hcm26/shop/commits?sha=bbb&per_page=100&page=2"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).header("x-ratelimit-remaining", "0")
                        .header("x-ratelimit-reset", String.valueOf(Instant.now().getEpochSecond() + 600)));

        assertThat(client.listCommits("ghs_c", "hcm26", "shop", "bbb", 1)).extracting("sha").containsExactly("c1", "c2");
        assertThatThrownBy(() -> client.listCommits("ghs_c", "hcm26", "shop", "bbb", 2))
                .isInstanceOfSatisfying(GitHubApiException.class, e -> {
                    assertThat(e.getKind()).isEqualTo(GitHubApiException.Kind.RATE_LIMITED);
                    assertThat(e.getRetryAfterSeconds()).isBetween(590L, 600L);
                });
        server.verify();
    }
}
