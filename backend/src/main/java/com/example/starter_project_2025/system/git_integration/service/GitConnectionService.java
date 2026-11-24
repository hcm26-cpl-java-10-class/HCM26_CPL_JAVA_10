package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.Optional;

/**
 * GI-02: "Check again" asks GitHub, with the App JWT (it does not depend on the installation token
 * that may be failing), whether the installation still exists and is suspended:
 * <ul>
 *   <li>404: DISCONNECTED (UNINSTALLED), linked repositories become DISCONNECTED (GI-05), data is kept
 *       (the same as the "deleted" webhook);</li>
 *   <li>{@code suspended_at}: SUSPENDED;</li>
 *   <li>otherwise CONNECTED (RECHECK_OK) and verified now.</li>
 * </ul>
 * GitHub unavailable or rate limited changes nothing. One check per installation every
 * {@value #COOLDOWN_SECONDS} seconds.
 */
@Slf4j
@Service
public class GitConnectionService {

    static final long COOLDOWN_SECONDS = 30;

    private final GitHubApiClient github;
    private final GitInstallationRepository installations;
    private final GitInstallationWriter writer;
    private final GitRepositoryConnectionWriter connectionWriter;
    private final InstallationTokenProvider tokens;
    private final InstallationRepositoryCache cache;
    private final Clock clock;

    public GitConnectionService(GitHubApiClient github, GitInstallationRepository installations, GitInstallationWriter writer,
                                GitRepositoryConnectionWriter connectionWriter, InstallationTokenProvider tokens,
                                InstallationRepositoryCache cache, @Qualifier("gitIntegrationClock") Clock clock) {
        this.github = github;
        this.installations = installations;
        this.writer = writer;
        this.connectionWriter = connectionWriter;
        this.tokens = tokens;
        this.cache = cache;
        this.clock = clock;
    }

    /** {@code checked = false}: checked less than the cooldown ago, the stored status is returned. */
    public record Recheck(GitInstallationStatus status, boolean checked) {
    }

    /** Runs outside any transaction: GitHub is called with no database connection held. */
    public Recheck recheck(Long installationRowId) {
        GitInstallation installation = installations.findById(installationRowId)
                .orElseThrow(GitIntegrationException::installationNotFound);
        LocalDateTime now = LocalDateTime.now(clock);
        if (installation.getLastCheckedAt() != null && installation.getLastCheckedAt().isAfter(now.minusSeconds(COOLDOWN_SECONDS))) {
            return new Recheck(installation.getStatus(), false);
        }
        Optional<GitHubInstallation> found;
        try {
            found = github.getInstallation(installation.getInstallationId());
        } catch (GitHubApiException e) {
            if (e.getKind() == GitHubApiException.Kind.RATE_LIMITED) throw GitIntegrationException.rateLimited(e.getRetryAfterSeconds());
            log.warn("GitHub connection check failed: installationId={}, reason={}", installation.getInstallationId(), e.getMessage());
            throw GitIntegrationException.providerUnavailable();
        }
        if (found.isEmpty()) {
            writer.transition(installation.getId(),
                    EnumSet.of(GitInstallationStatus.CONNECTED, GitInstallationStatus.SUSPENDED, GitInstallationStatus.ERROR),
                    GitInstallationStatus.DISCONNECTED, GitInstallationReason.UNINSTALLED);
            connectionWriter.disconnectByInstallation(installation.getId(), GitRepositoryReason.INSTALLATION_DELETED);
            forget(installation.getInstallationId());
        } else if (found.get().suspended()) {
            writer.transition(installation.getId(), EnumSet.of(GitInstallationStatus.CONNECTED, GitInstallationStatus.ERROR),
                    GitInstallationStatus.SUSPENDED, GitInstallationReason.SUSPENDED_ON_GITHUB);
            forget(installation.getInstallationId());
        } else {
            boolean changed = writer.transition(installation.getId(), EnumSet.of(GitInstallationStatus.ERROR, GitInstallationStatus.SUSPENDED),
                    GitInstallationStatus.CONNECTED, GitInstallationReason.RECHECK_OK);
            if (!changed && installation.getStatus() == GitInstallationStatus.CONNECTED) writer.touchVerified(installation.getId());
            if (changed) forget(installation.getInstallationId()); // a fresh token next time
        }
        String login = found.map(value -> value.account() == null ? null : value.account().login()).orElse(null);
        writer.touchChecked(installation.getId(), login);
        GitInstallationStatus status = installations.findById(installation.getId()).map(GitInstallation::getStatus).orElse(installation.getStatus());
        log.info("GitHub connection checked: installationId={}, status={}", installation.getInstallationId(), status);
        return new Recheck(status, true);
    }

    private void forget(long installationId) {
        tokens.invalidate(installationId);
        cache.evict(installationId);
    }
}
