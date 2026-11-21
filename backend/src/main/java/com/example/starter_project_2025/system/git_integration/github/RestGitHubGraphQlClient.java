package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubHistoryCommit;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * SY-01: {@link GitHubGraphQlClient} over {@code POST /graphql}. GraphQL reports most failures
 * with HTTP 200 and an {@code errors} array; they are mapped to the same
 * {@link GitHubApiException} kinds as the REST client. Messages never contain tokens or
 * response bodies.
 */
@Component
public class RestGitHubGraphQlClient implements GitHubGraphQlClient {

    static final String OPERATION = "commit history";

    static final String COMMIT_HISTORY_QUERY = """
            query($owner: String!, $name: String!, $first: Int!, $after: String, $since: GitTimestamp) {
              rateLimit { remaining resetAt cost }
              repository(owner: $owner, name: $name) {
                defaultBranchRef {
                  name
                  target {
                    ... on Commit {
                      oid
                      history(first: $first, after: $after, since: $since) {
                        totalCount
                        pageInfo { hasNextPage endCursor }
                        nodes {
                          oid message url authoredDate committedDate
                          parents { totalCount }
                          author { name email user { login databaseId } }
                          committer { name email user { login databaseId } }
                        }
                      }
                    }
                  }
                }
              }
            }""";

    private final RestClient restClient;
    private final GitHubAppProperties properties;

    public RestGitHubGraphQlClient(@Qualifier("gitHubRestClient") RestClient restClient, GitHubAppProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    @Override
    public GitHubCommitHistoryPage commitHistory(String installationToken, String owner, String name,
                                                 OffsetDateTime since, String after, int first) {
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("owner", owner);
        variables.put("name", name);
        variables.put("first", Math.max(1, Math.min(first, 100)));
        variables.put("after", after);
        variables.put("since", since == null ? null : since.toString());
        JsonNode body;
        try {
            body = restClient.post()
                    .uri(URI.create(properties.resolvedGraphqlUrl()))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + installationToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("query", COMMIT_HISTORY_QUERY, "variables", variables))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            throw RestGitHubApiClient.toApiException(OPERATION, e);
        } catch (RestClientException e) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, OPERATION, 0);
        }
        if (body == null || !body.isObject()) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, OPERATION, 200);
        }
        return parse(body, after != null);
    }

    static GitHubCommitHistoryPage parse(JsonNode body, boolean withCursor) {
        JsonNode data = body.path("data");
        GitHubCommitHistoryPage.RateLimit rateLimit = rateLimit(data.path("rateLimit"));
        List<String> errorTypes = new ArrayList<>();
        boolean cursorError = false;
        for (JsonNode error : body.path("errors")) {
            String type = error.path("type").asText("").toUpperCase(Locale.ROOT);
            errorTypes.add(type);
            String message = error.path("message").asText("").toLowerCase(Locale.ROOT);
            if (withCursor && (type.contains("CURSOR") || message.contains("cursor"))) cursorError = true;
        }
        if (errorTypes.contains("RATE_LIMITED")) {
            throw new GitHubApiException(GitHubApiException.Kind.RATE_LIMITED, OPERATION, 200, secondsUntil(rateLimit));
        }
        if (errorTypes.contains("FORBIDDEN")) {
            throw new GitHubApiException(GitHubApiException.Kind.REJECTED, OPERATION, 403);
        }
        JsonNode repository = data.path("repository");
        if (repository.isMissingNode() || repository.isNull()) {
            if (errorTypes.isEmpty() || errorTypes.contains("NOT_FOUND")) return GitHubCommitHistoryPage.notFound(rateLimit);
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, OPERATION, 200);
        }
        JsonNode branch = repository.path("defaultBranchRef");
        if (branch.isMissingNode() || branch.isNull()) {
            // No default branch: the repository has no commit yet (AC03).
            return new GitHubCommitHistoryPage(true, false, null, null, List.of(), false, null, 0, rateLimit);
        }
        JsonNode history = branch.path("target").path("history");
        if (history.isMissingNode() || history.isNull()) {
            if (cursorError) return GitHubCommitHistoryPage.invalidCursor(rateLimit);
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, OPERATION, 200);
        }
        List<GitHubHistoryCommit> commits = new ArrayList<>();
        for (JsonNode node : history.path("nodes")) {
            if (node.isNull()) continue;
            commits.add(new GitHubHistoryCommit(
                    text(node, "oid"), text(node, "message"), text(node, "url"),
                    text(node, "authoredDate"), text(node, "committedDate"),
                    node.path("parents").path("totalCount").isNumber() ? node.path("parents").path("totalCount").asInt() : null,
                    person(node.path("author")), person(node.path("committer"))));
        }
        JsonNode pageInfo = history.path("pageInfo");
        return new GitHubCommitHistoryPage(true, false, text(branch, "name"), text(branch.path("target"), "oid"),
                commits, pageInfo.path("hasNextPage").asBoolean(false), text(pageInfo, "endCursor"),
                history.path("totalCount").isNumber() ? history.path("totalCount").asInt() : null, rateLimit);
    }

    private static GitHubHistoryCommit.Person person(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) return null;
        JsonNode user = node.path("user");
        boolean hasUser = !user.isMissingNode() && !user.isNull();
        return new GitHubHistoryCommit.Person(text(node, "name"), text(node, "email"),
                hasUser ? text(user, "login") : null,
                hasUser && user.path("databaseId").isNumber() ? user.path("databaseId").asLong() : null);
    }

    private static GitHubCommitHistoryPage.RateLimit rateLimit(JsonNode node) {
        if (node.isMissingNode() || node.isNull() || !node.path("remaining").isNumber()) return null;
        Instant resetAt = null;
        try {
            String reset = text(node, "resetAt");
            if (reset != null) resetAt = Instant.parse(reset);
        } catch (DateTimeParseException ignored) {
            // Unknown format: the caller falls back to a default wait.
        }
        return new GitHubCommitHistoryPage.RateLimit(node.path("remaining").asInt(), resetAt, node.path("cost").asInt(1));
    }

    private static Long secondsUntil(GitHubCommitHistoryPage.RateLimit rateLimit) {
        if (rateLimit == null || rateLimit.resetAt() == null) return 60L;
        return Math.max(1L, rateLimit.resetAt().getEpochSecond() - Instant.now().getEpochSecond());
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }
}
