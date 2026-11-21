package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubHistoryCommit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** SY-01: the GraphQL commit history request and the mapping of GitHub's answers. */
class RestGitHubGraphQlClientTest {

    private MockRestServiceServer server;
    private RestGitHubGraphQlClient client;

    @BeforeEach
    void setUp() {
        GitHubAppProperties properties = new GitHubAppProperties();
        RestClient.Builder builder = RestClient.builder().baseUrl(properties.getApiBaseUrl());
        server = MockRestServiceServer.bindTo(builder).build();
        client = new RestGitHubGraphQlClient(builder.build(), properties);
    }

    @Test
    void readsAPageWithGitIdentitiesAndGitHubAccountsKeptApart() {
        String reset = Instant.now().plusSeconds(1800).toString();
        server.expect(requestTo("https://api.github.com/graphql"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer ghs_token"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.variables.owner").value("team"))
                .andExpect(jsonPath("$.variables.name").value("shop"))
                .andExpect(jsonPath("$.variables.first").value(100))
                .andExpect(jsonPath("$.variables.after").value("c1"))
                .andExpect(jsonPath("$.variables.since").value("2026-11-20T10:00Z"))
                .andExpect(jsonPath("$.query").value(org.hamcrest.Matchers.containsString("history(first: $first, after: $after, since: $since)")))
                .andRespond(withSuccess("""
                        {"data": {"rateLimit": {"remaining": 4990, "resetAt": "%s", "cost": 1},
                          "repository": {"defaultBranchRef": {"name": "main", "target": {"oid": "head1",
                            "history": {"totalCount": 2, "pageInfo": {"hasNextPage": true, "endCursor": "c2"},
                              "nodes": [
                                {"oid": "a1", "message": "Merge branch", "url": "https://github.com/team/shop/commit/a1",
                                 "authoredDate": "2026-11-21T08:00:00+07:00", "committedDate": "2026-11-21T08:05:00+07:00",
                                 "parents": {"totalCount": 2},
                                 "author": {"name": "Khanh", "email": "k@x.test", "user": {"login": "khanh-gh", "databaseId": 42}},
                                 "committer": {"name": "GitHub", "email": "noreply@github.com", "user": null}},
                                {"oid": "a2", "message": "fix", "url": "u", "authoredDate": "2026-11-20T01:00:00Z",
                                 "committedDate": "2026-11-20T01:00:00Z", "parents": {"totalCount": 1},
                                 "author": {"name": "Someone", "email": "s@x.test", "user": null}, "committer": null}
                              ]}}}}}}
                        """.formatted(reset), MediaType.APPLICATION_JSON));

        GitHubCommitHistoryPage page = client.commitHistory("ghs_token", "team", "shop",
                OffsetDateTime.of(2026, 11, 20, 10, 0, 0, 0, ZoneOffset.UTC), "c1", 100);

        assertThat(page.repositoryFound()).isTrue();
        assertThat(page.emptyRepository()).isFalse();
        assertThat(page.defaultBranch()).isEqualTo("main");
        assertThat(page.headOid()).isEqualTo("head1");
        assertThat(page.hasNextPage()).isTrue();
        assertThat(page.endCursor()).isEqualTo("c2");
        assertThat(page.rateLimit().remaining()).isEqualTo(4990);
        assertThat(page.rateLimit().resetAt()).isEqualTo(Instant.parse(reset));
        assertThat(page.commits()).hasSize(2);
        GitHubHistoryCommit merge = page.commits().get(0);
        assertThat(merge.parentCount()).isEqualTo(2);
        assertThat(merge.author()).isEqualTo(new GitHubHistoryCommit.Person("Khanh", "k@x.test", "khanh-gh", 42L));
        assertThat(merge.committer().login()).isNull();
        // An e-mail GitHub could not match: the Git identity only.
        assertThat(page.commits().get(1).author()).isEqualTo(new GitHubHistoryCommit.Person("Someone", "s@x.test", null, null));
        assertThat(page.commits().get(1).committer()).isNull();
        server.verify();
    }

    @Test
    void aRepositoryWithoutDefaultBranchIsEmptyNotAnError() {
        server.expect(requestTo("https://api.github.com/graphql"))
                .andRespond(withSuccess("{\"data\":{\"rateLimit\":{\"remaining\":10,\"resetAt\":null,\"cost\":1},"
                        + "\"repository\":{\"defaultBranchRef\":null}}}", MediaType.APPLICATION_JSON));

        GitHubCommitHistoryPage page = client.commitHistory("t", "team", "empty", null, null, 100);

        assertThat(page.emptyRepository()).isTrue();
        assertThat(page.commits()).isEmpty();
        assertThat(page.hasNextPage()).isFalse();
    }

    @Test
    void aRepositoryTheInstallationCannotSeeIsNotFound() {
        server.expect(requestTo("https://api.github.com/graphql"))
                .andRespond(withSuccess("{\"data\":{\"repository\":null},\"errors\":[{\"type\":\"NOT_FOUND\","
                        + "\"message\":\"Could not resolve to a Repository\"}]}", MediaType.APPLICATION_JSON));

        assertThat(client.commitHistory("t", "team", "gone", null, null, 100).repositoryFound()).isFalse();
    }

    @Test
    void aRejectedCursorIsReportedSoTheWindowCanBeReadAgain() {
        server.expect(requestTo("https://api.github.com/graphql"))
                .andRespond(withSuccess("{\"data\":{\"repository\":{\"defaultBranchRef\":{\"name\":\"main\",\"target\":"
                        + "{\"oid\":\"h\",\"history\":null}}}},\"errors\":[{\"message\":\"`abc` does not appear to be a valid cursor.\"}]}",
                        MediaType.APPLICATION_JSON));

        GitHubCommitHistoryPage page = client.commitHistory("t", "team", "shop", null, "abc", 100);

        assertThat(page.cursorRejected()).isTrue();
        assertThat(page.emptyRepository()).isFalse();
    }

    @Test
    void graphQlRateLimitWaitsUntilTheReset() {
        String reset = Instant.now().plusSeconds(600).toString();
        server.expect(requestTo("https://api.github.com/graphql"))
                .andRespond(withSuccess("{\"data\":{\"rateLimit\":{\"remaining\":0,\"resetAt\":\"" + reset + "\",\"cost\":1}},"
                        + "\"errors\":[{\"type\":\"RATE_LIMITED\",\"message\":\"API rate limit exceeded\"}]}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.commitHistory("t", "team", "shop", null, null, 100))
                .isInstanceOfSatisfying(GitHubApiException.class, e -> {
                    assertThat(e.getKind()).isEqualTo(GitHubApiException.Kind.RATE_LIMITED);
                    assertThat(e.getRetryAfterSeconds()).isBetween(590L, 600L);
                });
    }

    @Test
    void httpRateLimitAndServerErrorsMapLikeTheRestClient() {
        server.expect(requestTo("https://api.github.com/graphql"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).header("retry-after", "30"));
        assertThatThrownBy(() -> client.commitHistory("t", "team", "shop", null, null, 100))
                .isInstanceOfSatisfying(GitHubApiException.class, e -> {
                    assertThat(e.getKind()).isEqualTo(GitHubApiException.Kind.RATE_LIMITED);
                    assertThat(e.getRetryAfterSeconds()).isEqualTo(30L);
                });

        server.reset();
        server.expect(requestTo("https://api.github.com/graphql")).andRespond(withServerError());
        assertThatThrownBy(() -> client.commitHistory("ghs_secret", "team", "shop", null, null, 100))
                .isInstanceOfSatisfying(GitHubApiException.class, e -> {
                    assertThat(e.getKind()).isEqualTo(GitHubApiException.Kind.UNAVAILABLE);
                    assertThat(e.getMessage()).doesNotContain("ghs_secret");
                });
    }

    @Test
    void forbiddenIsRejected() {
        server.expect(requestTo("https://api.github.com/graphql"))
                .andRespond(withSuccess("{\"data\":{\"repository\":null},\"errors\":[{\"type\":\"FORBIDDEN\",\"message\":\"Resource not accessible by integration\"}]}",
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.commitHistory("t", "team", "shop", null, null, 100))
                .isInstanceOfSatisfying(GitHubApiException.class, e -> assertThat(e.getKind()).isEqualTo(GitHubApiException.Kind.REJECTED));
    }
}
