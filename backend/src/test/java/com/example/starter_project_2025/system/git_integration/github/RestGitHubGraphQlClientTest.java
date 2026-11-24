package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubActor;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubHistoryCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestNode;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewNode;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewPage;
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
    void readsPullRequestsWithStatesOrderAndSubmittedReviewsOnly() {
        server.expect(requestTo("https://api.github.com/graphql"))
                .andExpect(jsonPath("$.variables.first").value(50))
                .andExpect(jsonPath("$.variables.reviews").value(50))
                .andExpect(jsonPath("$.query").value(org.hamcrest.Matchers.containsString("states: [OPEN, CLOSED, MERGED]")))
                .andExpect(jsonPath("$.query").value(org.hamcrest.Matchers.containsString("orderBy: {field: UPDATED_AT, direction: DESC}")))
                .andExpect(jsonPath("$.query").value(org.hamcrest.Matchers.containsString(
                        "states: [APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED]")))
                .andExpect(jsonPath("$.query").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("PENDING"))))
                .andRespond(withSuccess("""
                        {"data": {"rateLimit": {"remaining": 4900, "resetAt": null, "cost": 26},
                          "repository": {"pullRequests": {"totalCount": 2, "pageInfo": {"hasNextPage": false, "endCursor": "p2"},
                            "nodes": [
                              {"id": "PR_1", "databaseId": 11, "number": 6, "title": "Feat", "body": "b", "url": "u",
                               "state": "MERGED", "merged": true, "isDraft": false, "createdAt": "2026-11-19T01:00:00Z",
                               "updatedAt": "2026-11-20T01:00:00Z", "closedAt": "2026-11-20T01:00:00Z", "mergedAt": "2026-11-20T01:00:00Z",
                               "headRefName": "feat/x", "headRefOid": "h1", "baseRefName": "main", "additions": 5, "deletions": 1,
                               "changedFiles": 2, "commits": {"totalCount": 3}, "mergeCommit": {"oid": "m1"}, "mergedBy": {"login": "lead"},
                               "author": {"login": "dependabot", "databaseId": 49699333},
                               "reviews": {"pageInfo": {"hasNextPage": true, "endCursor": "r1"}, "nodes": [
                                 {"databaseId": 101, "state": "APPROVED", "body": "", "url": "ru", "submittedAt": "2026-11-20T00:30:00Z",
                                  "updatedAt": "2026-11-20T00:30:00Z", "commit": {"oid": "h1"}, "author": {"login": "lead", "databaseId": 5}}]}},
                              {"id": "PR_2", "databaseId": 12, "number": 5, "title": "Old", "body": null, "url": "u2",
                               "state": "CLOSED", "merged": false, "isDraft": true, "createdAt": "2026-11-18T01:00:00Z",
                               "updatedAt": "2026-11-18T02:00:00Z", "closedAt": "2026-11-18T02:00:00Z", "mergedAt": null,
                               "headRefName": "old", "headRefOid": "h2", "baseRefName": "main", "additions": 0, "deletions": 0,
                               "changedFiles": 0, "commits": {"totalCount": 1}, "mergeCommit": null, "mergedBy": null, "author": null,
                               "reviews": {"pageInfo": {"hasNextPage": false, "endCursor": null}, "nodes": []}}
                            ]}}}}
                        """, MediaType.APPLICATION_JSON));

        GitHubPullRequestPage page = client.pullRequests("t", "team", "shop", null, 50, 50);

        assertThat(page.repositoryFound()).isTrue();
        assertThat(page.pullRequests()).hasSize(2);
        GitHubPullRequestNode merged = page.pullRequests().get(0);
        assertThat(merged.merged()).isTrue();
        assertThat(merged.commitsCount()).isEqualTo(3);
        assertThat(merged.mergeCommitOid()).isEqualTo("m1");
        assertThat(merged.author()).isEqualTo(new GitHubActor("dependabot", 49699333L)); // a Bot
        assertThat(merged.reviews()).singleElement().satisfies(review -> {
            assertThat(review.databaseId()).isEqualTo(101L);
            assertThat(review.state()).isEqualTo("APPROVED");
            assertThat(review.author().login()).isEqualTo("lead");
        });
        assertThat(merged.reviewsHasNextPage()).isTrue();
        assertThat(merged.reviewsEndCursor()).isEqualTo("r1");
        assertThat(page.pullRequests().get(1).author()).isNull(); // deleted account
        assertThat(page.pullRequests().get(1).draft()).isTrue();
        assertThat(page.rateLimit().cost()).isEqualTo(26);
    }

    @Test
    void readsTheFurtherReviewsOfAPullRequest() {
        server.expect(requestTo("https://api.github.com/graphql"))
                .andExpect(jsonPath("$.variables.id").value("PR_1"))
                .andExpect(jsonPath("$.variables.after").value("r1"))
                .andRespond(withSuccess("{\"data\":{\"node\":{\"reviews\":{\"pageInfo\":{\"hasNextPage\":false,\"endCursor\":\"r2\"},"
                        + "\"nodes\":[{\"databaseId\":102,\"state\":\"COMMENTED\",\"author\":{\"login\":\"qa\",\"databaseId\":6}}]}}}}",
                        MediaType.APPLICATION_JSON));

        GitHubReviewPage page = client.pullRequestReviews("t", "PR_1", "r1", 100);

        assertThat(page.reviews()).extracting(GitHubReviewNode::databaseId).containsExactly(102L);
        assertThat(page.hasNextPage()).isFalse();
    }

    @Test
    void pullRequestsOfARepositoryTheInstallationCannotSeeAreNotFound() {
        server.expect(requestTo("https://api.github.com/graphql"))
                .andRespond(withSuccess("{\"data\":{\"repository\":null},\"errors\":[{\"type\":\"NOT_FOUND\"}]}", MediaType.APPLICATION_JSON));

        assertThat(client.pullRequests("t", "team", "gone", null, 50, 50).repositoryFound()).isFalse();
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
