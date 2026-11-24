package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenIssuedEvent;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * GI-02: the one place that decides an installation is broken from what GitHub answered.
 * <ul>
 *   <li>404 when creating an installation token: ERROR (INSTALLATION_NOT_FOUND). Only the
 *       "deleted" webhook or "Check again" confirms DISCONNECTED, so linked repositories stay.</li>
 *   <li>401 on a call made with an installation token: the token is dropped first; a second 401
 *       within {@value #REPEAT_MINUTES} minutes (with a fresh token) means ERROR (TOKEN_REJECTED).</li>
 *   <li>403 "suspended": SUSPENDED.</li>
 *   <li>A token issued for an installation in ERROR: CONNECTED again (TOKEN_ISSUED).</li>
 * </ul>
 * A repository answering 404 is not an installation failure (GI-04 handles it).
 */
@Slf4j
@Component
public class InstallationHealth {

    static final long REPEAT_MINUTES = 10;

    private final GitInstallationWriter writer;
    private final GitInstallationRepository installations;
    private final InstallationTokenProvider tokens;
    private final InstallationRepositoryCache cache;
    private final Clock clock;
    /** Installation id → time of a first 401 not yet confirmed by a second one. */
    private final Map<Long, Instant> firstUnauthorized = new ConcurrentHashMap<>();

    public InstallationHealth(GitInstallationWriter writer, GitInstallationRepository installations,
                              InstallationTokenProvider tokens, InstallationRepositoryCache cache,
                              @Qualifier("gitIntegrationClock") Clock clock) {
        this.writer = writer;
        this.installations = installations;
        this.tokens = tokens;
        this.cache = cache;
        this.clock = clock;
    }

    /**
     * A GitHub failure met with an installation; returns the status the installation is in afterwards
     * when the failure was about the installation, else NULL (not an installation failure).
     */
    public GitInstallationStatus failed(Long installationRowId, long installationId, GitHubApiException e) {
        switch (e.getKind()) {
            case GONE -> {
                forget(installationId);
                writer.transition(installationRowId, EnumSet.of(GitInstallationStatus.CONNECTED),
                        GitInstallationStatus.ERROR, GitInstallationReason.INSTALLATION_NOT_FOUND);
                return currentOr(installationRowId, GitInstallationStatus.ERROR);
            }
            case SUSPENDED -> {
                forget(installationId);
                writer.transition(installationRowId, EnumSet.of(GitInstallationStatus.CONNECTED, GitInstallationStatus.ERROR),
                        GitInstallationStatus.SUSPENDED, GitInstallationReason.SUSPENDED_ON_GITHUB);
                return currentOr(installationRowId, GitInstallationStatus.SUSPENDED);
            }
            case REJECTED -> {
                if (e.getHttpStatus() != 401) return null;
                tokens.invalidate(installationId);
                Instant now = clock.instant();
                Instant first = firstUnauthorized.get(installationId);
                if (first == null || first.isBefore(now.minus(Duration.ofMinutes(REPEAT_MINUTES)))) {
                    firstUnauthorized.put(installationId, now); // maybe only a stale cached token: try again first
                    return null;
                }
                firstUnauthorized.remove(installationId);
                writer.transition(installationRowId, EnumSet.of(GitInstallationStatus.CONNECTED),
                        GitInstallationStatus.ERROR, GitInstallationReason.TOKEN_REJECTED);
                return currentOr(installationRowId, GitInstallationStatus.ERROR);
            }
            default -> {
                return null;
            }
        }
    }

    /**
     * A token was issued: the installation exists, so an ERROR clears by itself. A pending first 401
     * is kept: a fresh token is exactly what the second attempt must be made with.
     */
    @EventListener
    public void onTokenIssued(InstallationTokenIssuedEvent event) {
        installations.findByProviderAndInstallationId(GitProvider.GITHUB, event.installationId())
                .filter(row -> row.getStatus() == GitInstallationStatus.ERROR)
                .ifPresent(row -> writer.transition(row.getId(), EnumSet.of(GitInstallationStatus.ERROR),
                        GitInstallationStatus.CONNECTED, GitInstallationReason.TOKEN_ISSUED));
    }

    private GitInstallationStatus currentOr(Long installationRowId, GitInstallationStatus fallback) {
        return installations.findById(installationRowId).map(row -> row.getStatus()).orElse(fallback);
    }

    private void forget(long installationId) {
        tokens.invalidate(installationId);
        cache.evict(installationId);
    }
}
