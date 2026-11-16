package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Installation access tokens, kept in memory only (never persisted, logged or
 * returned) and reused until five minutes before GitHub expires them (1 hour).
 */
@Component
public class InstallationTokenProvider {

    private static final Duration REFRESH_MARGIN = Duration.ofMinutes(5);

    private final GitHubApiClient github;
    private final Clock clock;
    private final Map<Long, GitHubInstallationToken> tokens = new ConcurrentHashMap<>();

    public InstallationTokenProvider(GitHubApiClient github, @Qualifier("gitIntegrationClock") Clock clock) {
        this.github = github;
        this.clock = clock;
    }

    public String token(long installationId) {
        GitHubInstallationToken cached = tokens.get(installationId);
        if (cached != null && cached.expiresAt().minus(REFRESH_MARGIN).isAfter(clock.instant())) {
            return cached.token();
        }
        GitHubInstallationToken fresh = github.createInstallationToken(installationId);
        tokens.put(installationId, fresh);
        return fresh.token();
    }

    /** Drops a token GitHub rejected, or one belonging to an installation that is gone or suspended. */
    public void invalidate(long installationId) {
        tokens.remove(installationId);
    }
}
