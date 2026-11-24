package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubActor;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranchPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubComparePage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubHistoryCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestNode;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewNode;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewPage;
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
 * SY-01 / SY-02 / SY-07: {@link GitHubGraphQlClient} over {@code POST /graphql}. GraphQL reports most
 * failures with HTTP 200 and an {@code errors} array; they are mapped to the same
 * {@link GitHubApiException} kinds as the REST client. Messages never contain tokens or
 * response bodies.
 */
@Component
public class RestGitHubGraphQlClient implements GitHubGraphQlClient {

    static final String OPERATION = "commit history";
    static final String PULL_REQUESTS_OPERATION = "pull requests";
    static final String REVIEWS_OPERATION = "pull request reviews";
    static final String BRANCHES_OPERATION = "branches";
    static final String COMPARE_OPERATION = "branch commits";

    /** Fields of a commit, shared by the default branch history (SY-01) and the branch compare (SY-07). */
    static final String COMMIT_FIELDS = """
            oid message url authoredDate committedDate
            parents { totalCount }
            author { name email user { login databaseId } }
            committer { name email user { login databaseId } }""";

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
                        nodes { %s }
                      }
                    }
                  }
                }
              }
            }""".formatted(COMMIT_FIELDS);

    /** SY-07: branches in name order (a stable cursor), each with its head commit. */
    static final String BRANCHES_QUERY = """
            query($owner: String!, $name: String!, $first: Int!, $after: String) {
              rateLimit { remaining resetAt cost }
              repository(owner: $owner, name: $name) {
                defaultBranchRef { name }
                refs(refPrefix: "refs/heads/", first: $first, after: $after,
                     orderBy: {field: ALPHABETICAL, direction: ASC}) {
                  totalCount
                  pageInfo { hasNextPage endCursor }
                  nodes { name target { oid ... on Commit { committedDate } } }
                }
              }
            }""";

    /** SY-07: the commits of {@code $head} that are not on {@code $base} (qualified ref names). */
    static final String COMPARE_QUERY = """
            query($owner: String!, $name: String!, $base: String!, $head: String!, $first: Int!, $after: String) {
              rateLimit { remaining resetAt cost }
              repository(owner: $owner, name: $name) {
                ref(qualifiedName: $base) {
                  compare(headRef: $head) {
                    status aheadBy behindBy
                    commits(first: $first, after: $after) {
                      pageInfo { hasNextPage endCursor }
                      nodes { %s }
                    }
                  }
                }
              }
            }""".formatted(COMMIT_FIELDS);

    /** SY-02: submitted reviews only; PENDING (a draft only its author sees) is never requested (AC06). */
    static final String REVIEW_STATES = "states: [APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED]";

    static final String REVIEW_FIELDS = """
            databaseId state body url submittedAt updatedAt commit { oid }
            author { login ... on User { databaseId } ... on Bot { databaseId } }""";

    static final String PULL_REQUESTS_QUERY = """
            query($owner: String!, $name: String!, $first: Int!, $after: String, $reviews: Int!) {
              rateLimit { remaining resetAt cost }
              repository(owner: $owner, name: $name) {
                pullRequests(first: $first, after: $after, states: [OPEN, CLOSED, MERGED],
                             orderBy: {field: UPDATED_AT, direction: DESC}) {
                  totalCount
                  pageInfo { hasNextPage endCursor }
                  nodes {
                    id databaseId number title body url state merged isDraft
                    createdAt updatedAt closedAt mergedAt
                    headRefName headRefOid baseRefName
                    additions deletions changedFiles commits { totalCount }
                    mergeCommit { oid } mergedBy { login }
                    author { login ... on User { databaseId } ... on Bot { databaseId } }
                    reviews(first: $reviews, %s) {
                      pageInfo { hasNextPage endCursor }
                      nodes { %s }
                    }
                  }
                }
              }
            }""".formatted(REVIEW_STATES, REVIEW_FIELDS);

    static final String REVIEWS_QUERY = """
            query($id: ID!, $first: Int!, $after: String) {
              rateLimit { remaining resetAt cost }
              node(id: $id) {
                ... on PullRequest {
                  reviews(first: $first, after: $after, %s) {
                    pageInfo { hasNextPage endCursor }
                    nodes { %s }
                  }
                }
              }
            }""".formatted(REVIEW_STATES, REVIEW_FIELDS);

    private static final String HEADS = "refs/heads/";

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
        return parse(execute(installationToken, COMMIT_HISTORY_QUERY, variables, OPERATION), after != null);
    }

    @Override
    public GitHubPullRequestPage pullRequests(String installationToken, String owner, String name,
                                              String after, int first, int reviewsFirst) {
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("owner", owner);
        variables.put("name", name);
        variables.put("first", Math.max(1, Math.min(first, 100)));
        variables.put("after", after);
        variables.put("reviews", Math.max(1, Math.min(reviewsFirst, 100)));
        return parsePullRequests(execute(installationToken, PULL_REQUESTS_QUERY, variables, PULL_REQUESTS_OPERATION), after != null);
    }

    @Override
    public GitHubReviewPage pullRequestReviews(String installationToken, String pullRequestNodeId, String after, int first) {
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("id", pullRequestNodeId);
        variables.put("first", Math.max(1, Math.min(first, 100)));
        variables.put("after", after);
        JsonNode body = execute(installationToken, REVIEWS_QUERY, variables, REVIEWS_OPERATION);
        Errors errors = errors(body, false, REVIEWS_OPERATION);
        JsonNode reviews = body.path("data").path("node").path("reviews");
        if (reviews.isMissingNode() || reviews.isNull()) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, REVIEWS_OPERATION, 200);
        }
        return new GitHubReviewPage(reviews(reviews), reviews.path("pageInfo").path("hasNextPage").asBoolean(false),
                text(reviews.path("pageInfo"), "endCursor"), errors.rateLimit());
    }

    @Override
    public GitHubBranchPage branches(String installationToken, String owner, String name, String after, int first) {
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("owner", owner);
        variables.put("name", name);
        variables.put("first", Math.max(1, Math.min(first, 100)));
        variables.put("after", after);
        return parseBranches(execute(installationToken, BRANCHES_QUERY, variables, BRANCHES_OPERATION), after != null);
    }

    @Override
    public GitHubComparePage compare(String installationToken, String owner, String name, String base, String head,
                                     String after, int first) {
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("owner", owner);
        variables.put("name", name);
        variables.put("base", HEADS + base);
        variables.put("head", HEADS + head);
        variables.put("first", Math.max(1, Math.min(first, 100)));
        variables.put("after", after);
        return parseCompare(execute(installationToken, COMPARE_QUERY, variables, COMPARE_OPERATION), after != null);
    }

    private JsonNode execute(String token, String query, Map<String, Object> variables, String operation) {
        JsonNode body;
        try {
            body = restClient.post()
                    .uri(URI.create(properties.resolvedGraphqlUrl()))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("query", query, "variables", variables))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            throw RestGitHubApiClient.toApiException(operation, e);
        } catch (RestClientException e) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, operation, 0);
        }
        if (body == null || !body.isObject()) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, operation, 200);
        }
        return body;
    }

    /** Error types of an answer; throws for a rate limit or a refused permission. */
    private record Errors(List<String> types, boolean cursorRejected, GitHubCommitHistoryPage.RateLimit rateLimit) {
        boolean any() {
            return !types.isEmpty();
        }
    }

    private static Errors errors(JsonNode body, boolean withCursor, String operation) {
        GitHubCommitHistoryPage.RateLimit rateLimit = rateLimit(body.path("data").path("rateLimit"));
        List<String> types = new ArrayList<>();
        boolean cursorError = false;
        for (JsonNode error : body.path("errors")) {
            String type = error.path("type").asText("").toUpperCase(Locale.ROOT);
            types.add(type);
            String message = error.path("message").asText("").toLowerCase(Locale.ROOT);
            if (withCursor && (type.contains("CURSOR") || message.contains("cursor"))) cursorError = true;
        }
        if (types.contains("RATE_LIMITED")) {
            throw new GitHubApiException(GitHubApiException.Kind.RATE_LIMITED, operation, 200, secondsUntil(rateLimit));
        }
        if (types.contains("FORBIDDEN")) {
            throw new GitHubApiException(GitHubApiException.Kind.REJECTED, operation, 403);
        }
        return new Errors(types, cursorError, rateLimit);
    }

    static GitHubCommitHistoryPage parse(JsonNode body, boolean withCursor) {
        Errors errors = errors(body, withCursor, OPERATION);
        GitHubCommitHistoryPage.RateLimit rateLimit = errors.rateLimit();
        JsonNode repository = body.path("data").path("repository");
        if (repository.isMissingNode() || repository.isNull()) {
            if (!errors.any() || errors.types().contains("NOT_FOUND")) return GitHubCommitHistoryPage.notFound(rateLimit);
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, OPERATION, 200);
        }
        JsonNode branch = repository.path("defaultBranchRef");
        if (branch.isMissingNode() || branch.isNull()) {
            // No default branch: the repository has no commit yet (AC03).
            return new GitHubCommitHistoryPage(true, false, null, null, List.of(), false, null, 0, rateLimit);
        }
        JsonNode history = branch.path("target").path("history");
        if (history.isMissingNode() || history.isNull()) {
            if (errors.cursorRejected()) return GitHubCommitHistoryPage.invalidCursor(rateLimit);
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, OPERATION, 200);
        }
        List<GitHubHistoryCommit> commits = new ArrayList<>();
        for (JsonNode node : history.path("nodes")) {
            if (!node.isNull()) commits.add(historyCommit(node));
        }
        JsonNode pageInfo = history.path("pageInfo");
        return new GitHubCommitHistoryPage(true, false, text(branch, "name"), text(branch.path("target"), "oid"),
                commits, pageInfo.path("hasNextPage").asBoolean(false), text(pageInfo, "endCursor"),
                integer(history, "totalCount"), rateLimit);
    }

    static GitHubBranchPage parseBranches(JsonNode body, boolean withCursor) {
        Errors errors = errors(body, withCursor, BRANCHES_OPERATION);
        GitHubCommitHistoryPage.RateLimit rateLimit = errors.rateLimit();
        JsonNode repository = body.path("data").path("repository");
        if (repository.isMissingNode() || repository.isNull()) {
            if (!errors.any() || errors.types().contains("NOT_FOUND")) return GitHubBranchPage.notFound(rateLimit);
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, BRANCHES_OPERATION, 200);
        }
        JsonNode refs = repository.path("refs");
        if (refs.isMissingNode() || refs.isNull()) {
            if (errors.cursorRejected()) return GitHubBranchPage.invalidCursor(rateLimit);
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, BRANCHES_OPERATION, 200);
        }
        List<GitHubBranchPage.Branch> branches = new ArrayList<>();
        for (JsonNode node : refs.path("nodes")) {
            String branch = node.isNull() ? null : text(node, "name");
            if (branch == null || branch.isBlank()) continue;
            JsonNode target = node.path("target");
            branches.add(new GitHubBranchPage.Branch(branch, text(target, "oid"), text(target, "committedDate")));
        }
        JsonNode pageInfo = refs.path("pageInfo");
        return new GitHubBranchPage(true, false, text(repository.path("defaultBranchRef"), "name"), branches,
                pageInfo.path("hasNextPage").asBoolean(false), text(pageInfo, "endCursor"), integer(refs, "totalCount"), rateLimit);
    }

    static GitHubComparePage parseCompare(JsonNode body, boolean withCursor) {
        Errors errors = errors(body, withCursor, COMPARE_OPERATION);
        GitHubCommitHistoryPage.RateLimit rateLimit = errors.rateLimit();
        JsonNode repository = body.path("data").path("repository");
        if (repository.isMissingNode() || repository.isNull()) {
            if (!errors.any() || errors.types().contains("NOT_FOUND")) return GitHubComparePage.notFound(rateLimit);
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, COMPARE_OPERATION, 200);
        }
        JsonNode base = repository.path("ref");
        if (base.isMissingNode() || base.isNull()) return GitHubComparePage.refMissing(rateLimit); // base branch gone
        JsonNode comparison = base.path("compare");
        JsonNode commitsNode = comparison.path("commits");
        if (comparison.isMissingNode() || comparison.isNull() || commitsNode.isMissingNode() || commitsNode.isNull()) {
            if (errors.cursorRejected()) return GitHubComparePage.invalidCursor(rateLimit);
            if (errors.types().contains("NOT_FOUND")) return GitHubComparePage.refMissing(rateLimit); // head branch gone
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, COMPARE_OPERATION, 200);
        }
        List<GitHubHistoryCommit> commits = new ArrayList<>();
        for (JsonNode node : commitsNode.path("nodes")) {
            if (!node.isNull()) commits.add(historyCommit(node));
        }
        JsonNode pageInfo = commitsNode.path("pageInfo");
        return new GitHubComparePage(true, true, false, text(comparison, "status"), integer(comparison, "aheadBy"),
                integer(comparison, "behindBy"), commits, pageInfo.path("hasNextPage").asBoolean(false),
                text(pageInfo, "endCursor"), rateLimit);
    }

    private static GitHubHistoryCommit historyCommit(JsonNode node) {
        return new GitHubHistoryCommit(
                text(node, "oid"), text(node, "message"), text(node, "url"),
                text(node, "authoredDate"), text(node, "committedDate"),
                integer(node.path("parents"), "totalCount"),
                person(node.path("author")), person(node.path("committer")));
    }

    static GitHubPullRequestPage parsePullRequests(JsonNode body, boolean withCursor) {
        Errors errors = errors(body, withCursor, PULL_REQUESTS_OPERATION);
        GitHubCommitHistoryPage.RateLimit rateLimit = errors.rateLimit();
        JsonNode repository = body.path("data").path("repository");
        if (repository.isMissingNode() || repository.isNull()) {
            if (!errors.any() || errors.types().contains("NOT_FOUND")) return GitHubPullRequestPage.notFound(rateLimit);
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, PULL_REQUESTS_OPERATION, 200);
        }
        JsonNode connection = repository.path("pullRequests");
        if (connection.isMissingNode() || connection.isNull()) {
            if (errors.cursorRejected()) return GitHubPullRequestPage.invalidCursor(rateLimit);
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, PULL_REQUESTS_OPERATION, 200);
        }
        List<GitHubPullRequestNode> pullRequests = new ArrayList<>();
        for (JsonNode node : connection.path("nodes")) {
            if (node.isNull() || !node.path("number").isNumber()) continue;
            JsonNode reviews = node.path("reviews");
            pullRequests.add(new GitHubPullRequestNode(
                    text(node, "id"), longValue(node, "databaseId"), node.path("number").asInt(),
                    text(node, "title"), text(node, "body"), text(node, "url"), text(node, "state"),
                    node.path("merged").asBoolean(false), node.path("isDraft").asBoolean(false),
                    text(node, "createdAt"), text(node, "updatedAt"), text(node, "closedAt"), text(node, "mergedAt"),
                    text(node, "headRefName"), text(node, "headRefOid"), text(node, "baseRefName"),
                    integer(node, "additions"), integer(node, "deletions"), integer(node, "changedFiles"),
                    integer(node.path("commits"), "totalCount"),
                    text(node.path("mergeCommit"), "oid"), text(node.path("mergedBy"), "login"),
                    actor(node.path("author")),
                    reviews(reviews), reviews.path("pageInfo").path("hasNextPage").asBoolean(false),
                    text(reviews.path("pageInfo"), "endCursor")));
        }
        JsonNode pageInfo = connection.path("pageInfo");
        return new GitHubPullRequestPage(true, false, pullRequests, pageInfo.path("hasNextPage").asBoolean(false),
                text(pageInfo, "endCursor"), integer(connection, "totalCount"), rateLimit);
    }

    private static List<GitHubReviewNode> reviews(JsonNode connection) {
        List<GitHubReviewNode> reviews = new ArrayList<>();
        for (JsonNode node : connection.path("nodes")) {
            if (node.isNull()) continue;
            reviews.add(new GitHubReviewNode(longValue(node, "databaseId"), text(node, "state"), text(node, "body"),
                    text(node, "url"), text(node, "submittedAt"), text(node, "updatedAt"),
                    text(node.path("commit"), "oid"), actor(node.path("author"))));
        }
        return reviews;
    }

    private static GitHubActor actor(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) return null; // deleted account ("ghost")
        return new GitHubActor(text(node, "login"), longValue(node, "databaseId"));
    }

    private static GitHubHistoryCommit.Person person(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) return null;
        JsonNode user = node.path("user");
        boolean hasUser = !user.isMissingNode() && !user.isNull();
        return new GitHubHistoryCommit.Person(text(node, "name"), text(node, "email"),
                hasUser ? text(user, "login") : null, hasUser ? longValue(user, "databaseId") : null);
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

    private static Integer integer(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asInt() : null;
    }

    private static Long longValue(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asLong() : null;
    }
}
