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
import org.springframework.context.ApplicationEventPublisher;
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
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public GitInstallationWriter(GitInstallationRepository installations, ApplicationEventPublisher events,
                                 @Qualifier("gitIntegrationClock") Clock clock) {
        this.installations = installations;
        this.events = events;
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
        row.setDisconnectedByUserId(null);
        if (from != to) {
            row.setStatusReason(to == GitInstallationStatus.SUSPENDED ? GitInstallationReason.SUSPENDED_ON_GITHUB : GitInstallationReason.CONNECTED);
            row.setStatusChangedAt(now);
        }

        GitInstallation saved = installations.saveAndFlush(row);
        if (from != null && from != to) publish(saved, from, to, saved.getStatusReason());
        log.info("GitHub installation transition: installationId={}, tenantId={}, {} -> {}, trigger=callback, actorUserId={}",
                verified.id(), tenantId, from == null ? "NONE" : from, to, userId);
        return new UpsertResult(saved, existing.isPresent() ? GitOAuthOutcome.RECONNECTED : GitOAuthOutcome.CONNECTED);
    }

    /**
     * The only status transition (SY-03 webhooks, GI-02 failures and "Check again"), applied only
     * from the allowed states: GitHub does not guarantee delivery order, e.g. a late "unsuspend"
     * must not revive a removed installation. GI-02: records the reason and time and publishes
     * {@link GitInstallationStatusChangedEvent}. Returns true when the status changed.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean transition(Long installationRowId, Set<GitInstallationStatus> from, GitInstallationStatus to, String reason) {
        return installations.findById(installationRowId).map(row -> {
            GitInstallationStatus current = row.getStatus();
            if (current == to || !from.contains(current)) {
                return false;
            }
            LocalDateTime now = LocalDateTime.now(clock);
            row.setStatus(to);
            row.setStatusReason(reason);
            row.setStatusChangedAt(now);
            if (to == GitInstallationStatus.CONNECTED) row.setLastVerifiedAt(now);
            log.info("GitHub installation transition: installationId={}, tenantId={}, {} -> {}, reason={}",
                    row.getInstallationId(), row.getTenantId(), current, to, reason);
            publish(row, current, to, reason);
            return true;
        }).orElse(false);
    }

    /**
     * GI-07: the installation, locked by the caller's transaction, becomes DISCONNECTED (from any other
     * status). Joins the caller's transaction (GitInstallationDisconnectWriter) so the repositories
     * change with it. False when it already was DISCONNECTED (a second request, or the "deleted"
     * webhook came first).
     */
    @Transactional
    public boolean disconnect(GitInstallation row, Long actorUserId, String reason) {
        GitInstallationStatus current = row.getStatus();
        if (current == GitInstallationStatus.DISCONNECTED) return false;
        row.setStatus(GitInstallationStatus.DISCONNECTED);
        row.setStatusReason(reason);
        row.setStatusChangedAt(LocalDateTime.now(clock));
        row.setDisconnectedByUserId(actorUserId);
        installations.saveAndFlush(row);
        log.info("GitHub installation transition: installationId={}, tenantId={}, {} -> DISCONNECTED, reason={}, actorUserId={}",
                row.getInstallationId(), row.getTenantId(), current, reason, actorUserId);
        events.publishEvent(new GitInstallationStatusChangedEvent(row.getTenantId(), row.getId(), row.getAccountLogin(),
                current, GitInstallationStatus.DISCONNECTED, reason, actorUserId));
        return true;
    }

    /** GI-02: "Check again" was run (cooldown), whatever it found. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void touchChecked(Long installationRowId, String accountLogin) {
        installations.findById(installationRowId).ifPresent(row -> {
            row.setLastCheckedAt(LocalDateTime.now(clock));
            if (accountLogin != null && !accountLogin.isBlank()) row.setAccountLogin(accountLogin); // renamed on GitHub
        });
    }

    private void publish(GitInstallation row, GitInstallationStatus from, GitInstallationStatus to, String reason) {
        events.publishEvent(new GitInstallationStatusChangedEvent(row.getTenantId(), row.getId(), row.getAccountLogin(), from, to, reason));
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
