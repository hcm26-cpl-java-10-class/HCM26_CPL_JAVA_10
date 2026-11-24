package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppCredentials;
import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.Date;

/**
 * Signs the short-lived JWT GitHub requires for app-level calls
 * (e.g. GET /app/installations/{id}). See
 * https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 */
@Component
public class GitHubAppJwtFactory {

    /** Backdate iat to tolerate clock drift between this server and GitHub. */
    private static final long CLOCK_SKEW_SECONDS = 60;

    private final GitHubAppProperties properties;
    private final GitHubAppCredentials credentials;
    private final Clock clock;

    public GitHubAppJwtFactory(GitHubAppProperties properties, GitHubAppCredentials credentials,
                               @Qualifier("gitIntegrationClock") Clock clock) {
        this.properties = properties;
        this.credentials = credentials;
        this.clock = clock;
    }

    public String createAppJwt() {
        Instant now = clock.instant();
        return Jwts.builder()
                .setIssuer(properties.getAppId())
                .setIssuedAt(Date.from(now.minusSeconds(CLOCK_SKEW_SECONDS)))
                .setExpiration(Date.from(now.plusSeconds(properties.getJwtTtlSeconds())))
                .signWith(credentials.privateKey(), SignatureAlgorithm.RS256)
                .compact();
    }
}
