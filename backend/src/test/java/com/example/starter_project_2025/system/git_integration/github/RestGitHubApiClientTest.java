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
}
