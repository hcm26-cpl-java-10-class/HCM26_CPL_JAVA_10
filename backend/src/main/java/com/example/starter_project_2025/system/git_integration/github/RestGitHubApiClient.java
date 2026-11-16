package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubOAuthTokenResponse;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUserInstallationsPage;
import org.springframework.beans.factory.annotation.Qualifier;
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

import java.net.URI;
import java.util.Optional;
import java.util.function.Supplier;

@Component
public class RestGitHubApiClient implements GitHubApiClient {

    private static final int PAGE_SIZE = 100;
    /** Safety cap: 1,000 installations is far beyond what a single user can see in practice. */
    private static final int MAX_PAGES = 10;

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

    /**
     * Runs a GitHub call and maps every failure to {@link GitHubApiException}
     * without copying response bodies or URLs into the message.
     */
    private <T> T call(String operation, Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientResponseException e) {
            HttpStatusCode status = e.getStatusCode();
            GitHubApiException.Kind kind = status.is5xxServerError()
                    ? GitHubApiException.Kind.UNAVAILABLE
                    : GitHubApiException.Kind.REJECTED;
            throw new GitHubApiException(kind, operation, status.value());
        } catch (RestClientException e) {
            throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, operation, 0);
        }
    }

    private static String trimTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
