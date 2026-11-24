package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationRepositoriesPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;

/**
 * GI-03: the repositories an installation can access, fetched from GitHub
 * and cached in memory per installation ({@code app.github.repository-cache-ttl-seconds}).
 * <ul>
 *   <li>Concurrent requests for the same installation trigger a single GitHub fetch.</li>
 *   <li>A forced refresh is honoured at most once every 10 seconds per installation.</li>
 *   <li>Failures are never cached and never replaced by expired data (AC04).</li>
 * </ul>
 * Single-node cache; move to Redis if the backend is scaled out.
 */
@Slf4j
@Component
public class InstallationRepositoryCache {

    static final int PAGE_SIZE = 100;
    static final Duration REFRESH_THROTTLE = Duration.ofSeconds(10);

    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final GitHubAppProperties properties;
    private final Clock clock;

    private final Map<Long, Snapshot> snapshots = new ConcurrentHashMap<>();
    private final Map<Long, CompletableFuture<Snapshot>> inFlight = new ConcurrentHashMap<>();
    private final Map<Long, Instant> lastForcedRefresh = new ConcurrentHashMap<>();

    public InstallationRepositoryCache(GitHubApiClient github, InstallationTokenProvider tokens,
                                       GitHubAppProperties properties, @Qualifier("gitIntegrationClock") Clock clock) {
        this.github = github;
        this.tokens = tokens;
        this.properties = properties;
        this.clock = clock;
    }

    /** Verified list of an installation's repositories at {@code fetchedAt}. */
    public record Snapshot(List<GitHubRepository> repositories, Instant fetchedAt, boolean truncated) {
    }

    public record Result(Snapshot snapshot, boolean fromCache) {
    }

    public Result get(long installationId, boolean refresh) {
        Instant now = clock.instant();
        Snapshot cached = snapshots.get(installationId);
        boolean fresh = cached != null && cached.fetchedAt().plusSeconds(properties.getRepositoryCacheTtlSeconds()).isAfter(now);

        boolean forced = refresh && !recentlyForced(installationId, now);
        if (fresh && !forced) {
            return new Result(cached, true);
        }
        if (forced) {
            lastForcedRefresh.put(installationId, now);
        }

        CompletableFuture<Snapshot> mine = new CompletableFuture<>();
        CompletableFuture<Snapshot> running = inFlight.putIfAbsent(installationId, mine);
        if (running != null) {
            return new Result(await(running), false);
        }
        try {
            Snapshot snapshot = fetch(installationId);
            snapshots.put(installationId, snapshot);
            mine.complete(snapshot);
            return new Result(snapshot, false);
        } catch (RuntimeException e) {
            // Never serve data GitHub did not just confirm: drop any stale entry as well.
            snapshots.remove(installationId);
            mine.completeExceptionally(e);
            throw e;
        } finally {
            inFlight.remove(installationId, mine);
        }
    }

    /** Forgets everything about an installation (e.g. it was suspended or uninstalled). */
    public void evict(long installationId) {
        snapshots.remove(installationId);
        lastForcedRefresh.remove(installationId);
        tokens.invalidate(installationId);
    }

    private boolean recentlyForced(long installationId, Instant now) {
        Instant last = lastForcedRefresh.get(installationId);
        return last != null && last.plus(REFRESH_THROTTLE).isAfter(now);
    }

    private Snapshot fetch(long installationId) {
        String token = tokens.token(installationId);
        List<GitHubRepository> repositories = new ArrayList<>();
        int maxPages = Math.max(1, properties.getRepositoryMaxPages());
        boolean truncated = false;
        try {
            for (int page = 1; page <= maxPages; page++) {
                GitHubInstallationRepositoriesPage result = github.listInstallationRepositories(token, page);
                List<GitHubRepository> batch = result.repositories() == null ? List.of() : result.repositories();
                repositories.addAll(batch);
                int total = result.totalCount() == null ? repositories.size() : result.totalCount();
                if (batch.isEmpty() || repositories.size() >= total) {
                    break;
                }
                if (page == maxPages) {
                    truncated = true;
                    log.warn("Repository list truncated at {} pages: installationId={}, total={}", maxPages, installationId, total);
                }
            }
        } catch (GitHubApiException e) {
            if (e.getHttpStatus() == 401) {
                tokens.invalidate(installationId); // token revoked early: mint a new one next time
            }
            throw e;
        }
        log.info("Fetched repositories from GitHub: installationId={}, count={}", installationId, repositories.size());
        return new Snapshot(List.copyOf(repositories), clock.instant(), truncated);
    }

    private static Snapshot await(CompletableFuture<Snapshot> future) {
        try {
            return future.join();
        } catch (CompletionException e) {
            if (e.getCause() instanceof RuntimeException runtime) throw runtime;
            throw e;
        }
    }
}
