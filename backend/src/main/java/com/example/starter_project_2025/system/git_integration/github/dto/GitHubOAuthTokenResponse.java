package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response of POST https://github.com/login/oauth/access_token. GitHub answers
 * HTTP 200 even on failure, with {@code error} set instead of a token.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubOAuthTokenResponse(
        @JsonProperty("access_token") String accessToken,
        @JsonProperty("token_type") String tokenType,
        String error) {

    @Override
    public String toString() {
        return "GitHubOAuthTokenResponse[tokenType=" + tokenType + ", error=" + error + "]";
    }
}
