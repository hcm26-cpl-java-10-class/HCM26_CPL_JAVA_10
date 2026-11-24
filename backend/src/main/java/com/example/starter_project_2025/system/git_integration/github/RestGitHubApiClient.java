package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranch;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCompareResult;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationRepositoriesPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubOAuthTokenResponse;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUserInstallationsPage;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class RestGitHubApiClient implements GitHubApiClient {
    @Override
    public com.fasterxml.jackson.databind.JsonNode getPullRequest(String token, String owner, String repository, int number) {
        return call("get pull request", () -> restClient.get()
                .uri("/repos/{owner}/{repository}/pulls/{number}", owner, repository, number)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).retrieve()
                .body(com.fasterxml.jackson.databind.JsonNode.class));
    }

    @Override
    public com.fasterxml.jackson.databind.JsonNode getPullRequestReview(String token, String owner, String repository,
                                                                       int number, long reviewId) {
        return call("get pull request review", () -> restClient.get()
                .uri("/repos/{owner}/{repository}/pulls/{number}/reviews/{reviewId}", owner, repository, number, reviewId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).retrieve()
                .body(com.fasterxml.jackson.databind.JsonNode.class));
    }

    private static final int PAGE_SIZE = 100;
    /** Safety cap: 1,000 installations is far beyond what a single user can see in practice. */
    private static final int MAX_PAGES = 10;
    /** Least privilege: listing and reading repositories only needs read-only metadata. */
    static final Map<String, String> METADATA_PERMISSIONS = Map.of("metadata", "read");
    /** SY-04: reading commits (Compare / List Commits) also needs read-only contents. */
    static final Map<String, String> CONTENTS_PERMISSIONS = Map.of("metadata", "read", "contents", "read", "pull_requests", "read");

    private final RestClient restClient;
    private final GitHubAppProperties properties;
    private final GitHubAppJwtFactory jwtFactory;

    public RestGitHubApiClient(@Qualifier("gitHubRestClient") RestClient restClient,
                               GitHubAppProperties properties,
                               GitHubAppJwtFactory jwtFactory) {
        this.restClient = restClient;
        this.properties = properties;
        this.jwtFactory = jwtFactory;
    }

    @Override
    public String exchangeCodeForUserToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", properties.getClientId());
        form.add("client_secret", properties.getClientSecret());
        form.add("code", code);
        form.add("redirect_uri", properties.getCallbackUrl());

        // The token endpoint lives on github.com, not api.github.com: use an absolute URI.
        URI tokenUri = URI.create(trimTrailingSlash(properties.getWebBaseUrl()) + "/login/oauth/access_token");
        GitHubOAuthTokenResponse response = call("token exchange", () -> restClient.post()
                .uri(tokenUri)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .body(form)
                .retrieve()
                .body(GitHubOAuthTokenResponse.class));

        if (response == null || StringUtils.hasText(response.error()) || !StringUtils.hasText(response.accessToken())) {
            throw new GitHubApiException(GitHubApiException.Kind.REJECTED, "token exchange", 200);
        }
        return response.accessToken();
    }

    @Override
    public GitHubUser getAuthenticatedUser(String userToken) {
        GitHubUser user = call("get user", () -> restClient.get()
                .uri("/user")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + userToken)
                .retrieve()
                .body(GitHubUser.class));
        if (user == null || user.id() == null) {
            throw new GitHubApiException(GitHubApiException.Kind.REJECTED, "get user", 200);
        }
        return user;
    }

    @Override
    public boolean userCanAccessInstallation(String userToken, long installationId) {
        for (int page = 1; page <= MAX_PAGES; page++) {
            int currentPage = page;
            GitHubUserInstallationsPage result = call("list user installations", () -> restClient.get()
                    .uri(uri -> uri.path("/user/installations")
                            .queryParam("per_page", PAGE_SIZE)
                            .queryParam("page", currentPage)
                            .build())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + userToken)
                    .retrieve()
                    .body(GitHubUserInstallationsPage.class));
            if (result == null || result.installations() == null || result.installations().isEmpty()) {
                return false;
            }
            if (result.installations().stream().anyMatch(i -> i.id() != null && i.id() == installationId)) {
                return true;
            }
            int total = result.totalCount() == null ? 0 : result.totalCount();
            if ((long) page * PAGE_SIZE >= total) {
                return false;
            }
        }
        return false;
    }

    @Override
    public Optional<GitHubInstallation> getInstallation(long installationId) {
        try {
            return Optional.ofNullable(call("get installation", () -> restClient.get()
                    .uri("/app/installations/{id}", installationId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtFactory.createAppJwt())
                    .retrieve()
                    .body(GitHubInstallation.class)));
        } catch (GitHubApiException e) {
            if (e.getHttpStatus() == 404) {
                return Optional.empty();
            }
            throw e;
        }
    }

    @Override
    public DeleteOutcome deleteInstallation(long installationId) {
        try {
            call("delete installation", () -> restClient.delete()
                    .uri("/app/installations/{id}", installationId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtFactory.createAppJwt())
                    .retrieve()
                    .toBodilessEntity());
            return DeleteOutcome.DELETED;
        } catch (GitHubApiException e) {
            if (e.getHttpStatus() == 404) {
                return DeleteOutcome.NOT_FOUND;
            }
            throw e;
        }
    }

    @Override
    public GitHubInstallationToken createInstallationToken(long installationId) {
        return createToken(installationId, METADATA_PERMISSIONS, "create installation token");
    }

    @Override
    public GitHubInstallationToken createContentsToken(long installationId) {
        return createToken(installationId, CONTENTS_PERMISSIONS, "create contents token");
    }

    private GitHubInstallationToken createToken(long installationId, Map<String, String> permissions, String operation) {
        GitHubInstallationToken token;
        try {
            token = restClient.post()
                    .uri("/app/installations/{id}/access_tokens", installationId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtFactory.createAppJwt())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("permissions", permissions))
                    .retrieve()
                    .body(GitHubInstallationToken.class);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            if (status == 404) {
                throw new GitHubApiException(GitHubApiException.Kind.GONE, operation, status);
            }
            // The body is inspected, never copied into the exception.
            if (status == 403 && e.getResponseBodyAsString().toLowerCase(Locale.ROOT).contains("suspended")) {
                throw new GitHubApiException(GitHubApiException.Kind.SUSPENDED, operation, status);
            }
            throw toApiException(operation, e);
        } catch (RestClientException e) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, operation, 0);
        }
        if (token == null || !StringUtils.hasText(token.token()) || token.expiresAt() == null) {
            throw new GitHubApiException(GitHubApiException.Kind.REJECTED, operation, 200);
        }
        return token;
    }

    @Override
    public GitHubInstallationRepositoriesPage listInstallationRepositories(String installationToken, int page) {
        GitHubInstallationRepositoriesPage result = call("list installation repositories", () -> restClient.get()
                .uri(uri -> uri.path("/installation/repositories")
                        .queryParam("per_page", PAGE_SIZE)
                        .queryParam("page", page)
                        .build())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + installationToken)
                .retrieve()
                .body(GitHubInstallationRepositoriesPage.class));
        if (result == null) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "list installation repositories", 200);
        }
        return result;
    }

    @Override
    public Optional<GitHubRepository> getRepository(String installationToken, long repositoryId) {
        try {
            GitHubRepository repository = call("get repository", () -> restClient.get()
                    .uri("/repositories/{id}", repositoryId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + installationToken)
                    .retrieve()
                    .body(GitHubRepository.class));
            if (repository == null || repository.id() == null) {
                throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "get repository", 200);
            }
            return Optional.of(repository);
        } catch (GitHubApiException e) {
            // Rate limits were already classified as RATE_LIMITED; a plain 403/404 means "no access".
            if (e.getKind() == GitHubApiException.Kind.REJECTED && (e.getHttpStatus() == 404 || e.getHttpStatus() == 403)) {
                return Optional.empty();
            }
            throw e;
        }
    }

    @Override
    public List<GitHubBranch> listBranches(String installationToken, String owner, String repository, int page) {
        List<GitHubBranch> branches = call("list branches", () -> restClient.get()
                .uri(uri -> uri.path("/repos/{owner}/{repo}/branches")
                        .queryParam("per_page", PAGE_SIZE)
                        .queryParam("page", page)
                        .build(owner, repository))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + installationToken)
                .retrieve()
                .body(new ParameterizedTypeReference<List<GitHubBranch>>() { }));
        return branches == null ? List.of() : branches;
    }

    @Override
    public GitHubCompareResult compareCommits(String installationToken, String owner, String repository,
                                              String base, String head, int page) {
        GitHubCompareResult result = call("compare commits", () -> restClient.get()
                .uri(uri -> uri.path("/repos/{owner}/{repo}/compare/{basehead}")
                        .queryParam("per_page", PAGE_SIZE)
                        .queryParam("page", page)
                        .build(owner, repository, base + "..." + head))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + installationToken)
                .retrieve()
                .body(GitHubCompareResult.class));
        if (result == null) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "compare commits", 200);
        }
        return result;
    }

    @Override
    public List<GitHubCommit> listCommits(String installationToken, String owner, String repository, String sha, int page) {
        List<GitHubCommit> commits = call("list commits", () -> restClient.get()
                .uri(uri -> uri.path("/repos/{owner}/{repo}/commits")
                        .queryParam("sha", sha)
                        .queryParam("per_page", PAGE_SIZE)
                        .queryParam("page", page)
                        .build(owner, repository))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + installationToken)
                .retrieve()
                .body(new ParameterizedTypeReference<List<GitHubCommit>>() { }));
        return commits == null ? List.of() : commits;
    }

    @Override
    public GitHubCommit getCommit(String token, String owner, String repository, String sha) {
        GitHubCommit commit = call("get commit metadata", () -> restClient.get()
                .uri("/repos/{owner}/{repository}/commits/{sha}", owner, repository, sha)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .retrieve().body(GitHubCommit.class));
        if (commit == null || !sha.equals(commit.sha()) || commit.parents() == null) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "get commit metadata", 200);
        }
        return commit;
    }

    /**
     * Runs a GitHub call and maps every failure to {@link GitHubApiException}
     * without copying response bodies or URLs into the message.
     */
    private <T> T call(String operation, Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientResponseException e) {
            throw toApiException(operation, e);
        } catch (RestClientException e) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, operation, 0);
        }
    }

    static GitHubApiException toApiException(String operation, RestClientResponseException e) {
        HttpStatusCode status = e.getStatusCode();
        Long retryAfter = rateLimitRetryAfter(e);
        if (retryAfter != null) {
            return new GitHubApiException(GitHubApiException.Kind.RATE_LIMITED, operation, status.value(), retryAfter);
        }
        GitHubApiException.Kind kind = status.is5xxServerError()
                ? GitHubApiException.Kind.UNAVAILABLE
                : GitHubApiException.Kind.REJECTED;
        return new GitHubApiException(kind, operation, status.value());
    }

    /**
     * Seconds to wait when GitHub reports a primary (x-ratelimit-remaining: 0)
     * or secondary (retry-after) rate limit; null when the error is not a rate limit.
     */
    private static Long rateLimitRetryAfter(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        if (status != 403 && status != 429) return null;
        HttpHeaders headers = e.getResponseHeaders();
        if (headers == null) return status == 429 ? 60L : null;
        String retryAfter = headers.getFirst("retry-after");
        if (retryAfter != null && retryAfter.matches("\\d+")) return Long.parseLong(retryAfter);
        if ("0".equals(headers.getFirst("x-ratelimit-remaining"))) {
            String reset = headers.getFirst("x-ratelimit-reset");
            if (reset != null && reset.matches("\\d+")) {
                return Math.max(1L, Long.parseLong(reset) - Instant.now().getEpochSecond());
            }
            return 60L;
        }
        return status == 429 ? 60L : null;
    }

    private static String trimTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
