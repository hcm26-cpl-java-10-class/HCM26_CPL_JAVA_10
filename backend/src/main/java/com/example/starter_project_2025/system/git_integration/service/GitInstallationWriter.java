package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Set;

/**
 * The only writer of {@code git_installations}: every status transition goes
 * through here (optimistic locking via {@code @Version}). Called after all
 * GitHub checks passed, in a short transaction of its own.
 */
@Slf4j
@Service
public class GitInstallationWriter {

    private final GitInstallationRepository installations;
    private final Clock clock;

    public GitInstallationWriter(GitInstallationRepository installations,
                                 @Qualifier("gitIntegrationClock") Clock clock) {
        this.installations = installations;
        this.clock = clock;
    }

    public record UpsertResult(GitInstallation installation, GitOAuthOutcome outcome) {
    }

    /**
     * Verified callback: T1/T2 (new row), T3/T4/T8 (same tenant reconnects the
     * stored installation). An installation held by another tenant is never taken over.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UpsertResult upsertVerified(Long tenantId, Long userId, GitHubInstallation verified, GitHubUser githubUser) {
        LocalDateTime now = LocalDateTime.now(clock);
        var existing = installations.findByProviderAndInstallationId(GitProvider.GITHUB, verified.id());
        if (existing.isPresent() && !existing.get().getTenantId().equals(tenantId)) {
            throw GitIntegrationException.linkedElsewhere();
        }

        GitInstallation row = existing.orElseGet(() -> GitInstallation.builder()
                .tenantId(tenantId)
                .provider(GitProvider.GITHUB)
                .installationId(verified.id())
                .build());
        GitInstallationStatus from = existing.map(GitInstallation::getStatus).orElse(null);
        GitInstallationStatus to = verified.suspended() ? GitInstallationStatus.SUSPENDED : GitInstallationStatus.CONNECTED;

        row.setAccountId(verified.account().id());
        row.setAccountLogin(verified.account().login());
        row.setAccountType(verified.account().type());
        row.setRepositorySelection(verified.repositorySelection());
        row.setStatus(to);
        row.setIsActive(true);
        row.setConnectedByUserId(userId);
        row.setGithubUserId(githubUser.id());
        row.setGithubUserLogin(githubUser.login());
        row.setConnectedAt(now);
        row.setLastVerifiedAt(now);

        GitInstallation saved = installations.saveAndFlush(row);
        log.info("GitHub installation transition: installationId={}, tenantId={}, {} -> {}, trigger=callback, actorUserId={}",
                verified.id(), tenantId, from == null ? "NONE" : from, to, userId);
        return new UpsertResult(saved, existing.isPresent() ? GitOAuthOutcome.RECONNECTED : GitOAuthOutcome.CONNECTED);
    }

    /**
     * T5 (→ SUSPENDED) / T6 (→ DISCONNECTED) detected by the system, e.g. when
     * GitHub refuses an installation token. No-op when already in that status.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markStatus(Long installationRowId, GitInstallationStatus to, String trigger) {
        installations.findById(installationRowId).ifPresent(row -> {
            GitInstallationStatus from = row.getStatus();
            if (from == to) {
                return;
            }
            row.setStatus(to);
            row.setLastVerifiedAt(LocalDateTime.now(clock));
            log.info("GitHub installation transition: installationId={}, tenantId={}, {} -> {}, trigger={}, actor=system",
                    row.getInstallationId(), row.getTenantId(), from, to, trigger);
        });
    }

    /**
     * SY-03: a webhook-driven transition, applied only from the allowed states (GitHub does
     * not guarantee delivery order, e.g. a late "unsuspend" must not revive a removed installation).
     * Returns true when the status changed.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean transition(Long installationRowId, Set<GitInstallationStatus> from, GitInstallationStatus to, String trigger) {
        return installations.findById(installationRowId).map(row -> {
            GitInstallationStatus current = row.getStatus();
            if (current == to || !from.contains(current)) {
                return false;
            }
            row.setStatus(to);
            row.setLastVerifiedAt(LocalDateTime.now(clock));
            log.info("GitHub installation transition: installationId={}, tenantId={}, {} -> {}, trigger={}, actor=github",
                    row.getInstallationId(), row.getTenantId(), current, to, trigger);
            return true;
        }).orElse(false);
    }

    /** SY-03: GitHub confirmed the installation (e.g. new permissions accepted) without a status change. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void touchVerified(Long installationRowId) {
        installations.findById(installationRowId).ifPresent(row -> row.setLastVerifiedAt(LocalDateTime.now(clock)));
    }

    /** SY-03: {@code installation_repositories} changed which repositories the app may access. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateRepositorySelection(Long installationRowId, String repositorySelection) {
        installations.findById(installationRowId).ifPresent(row -> {
            if (repositorySelection != null) row.setRepositorySelection(repositorySelection);
            row.setLastVerifiedAt(LocalDateTime.now(clock));
        });
    }
}
