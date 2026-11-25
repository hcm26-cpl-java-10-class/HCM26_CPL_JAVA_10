package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one place that changes the status of an existing repository connection (GI-05 state machine)
 * and refreshes its snapshot. Joins the caller's transaction when there is one.
 * <ul>
 *   <li>ACTIVE / ERROR → DISCONNECTED: GitHub took the access away (webhooks, "Check again" 404).</li>
 *   <li>ACTIVE → ERROR: calling GitHub for the repository failed; ERROR → ACTIVE once it works again.</li>
 *   <li>DISCONNECTED → ACTIVE: access granted back (unless another project synchronizes the repository meanwhile).</li>
 *   <li>any but INACTIVE → INACTIVE: unlinked by a user ({@link #unlink}).</li>
 * </ul>
 * Every real change records the reason and time and publishes {@link GitRepositoryStatusChangedEvent}.
 */
@Slf4j
@Service
public class GitRepositoryConnectionWriter {
    @Autowired
    private GitEntityReferences entityReferences;

    private final GitRepositoryRepository connections;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public GitRepositoryConnectionWriter(GitRepositoryRepository connections, ApplicationEventPublisher events,
                                         @Qualifier("gitIntegrationClock") Clock clock) {
        this.connections = connections;
        this.events = events;
        this.clock = clock;
    }

    /** Applies {@code from → to} when the current status is one of {@code from}; returns true when it changed. */
    @Transactional
    public boolean transition(Long repositoryId, Set<GitRepositoryStatus> from, GitRepositoryStatus to, String reason) {
        return connections.findById(repositoryId)
                .map(row -> apply(row, from, to, reason))
                .orElse(false);
    }

    /** Sync / API failure on an ACTIVE connection. */
    @Transactional
    public boolean markError(Long repositoryId, String reason) {
        return transition(repositoryId, EnumSet.of(GitRepositoryStatus.ACTIVE), GitRepositoryStatus.ERROR, reason);
    }

    /** A synchronization of a connection in ERROR succeeded. */
    @Transactional
    public boolean recover(Long repositoryId) {
        return transition(repositoryId, EnumSet.of(GitRepositoryStatus.ERROR), GitRepositoryStatus.ACTIVE, null);
    }

    /** SY-03 {@code repository.deleted}, or "Check again" confirmed the loss. */
    @Transactional
    public boolean disconnect(Long repositoryId, String reason) {
        return transition(repositoryId, GitRepositoryRepository.RECEIVING, GitRepositoryStatus.DISCONNECTED, reason);
    }

    /** SY-03 {@code installation.deleted}: every connection reached through the installation that still receives events. */
    @Transactional
    public int disconnectByInstallation(Long installationRowId, String reason) {
        List<GitRepository> rows = connections.findByInstallation_IdAndStatusIn(installationRowId, GitRepositoryRepository.RECEIVING);
        rows.forEach(row -> apply(row, GitRepositoryRepository.RECEIVING, GitRepositoryStatus.DISCONNECTED, reason));
        return rows.size();
    }

    /** SY-03 {@code installation_repositories.removed}: the connection of one repository through that installation. */
    @Transactional
    public boolean disconnect(Long installationRowId, Long externalId, String reason) {
        boolean changed = false;
        for (GitRepository row : connections.findByInstallation_IdAndExternalIdAndStatusIn(
                installationRowId, externalId, GitRepositoryRepository.RECEIVING)) {
            changed |= apply(row, GitRepositoryRepository.RECEIVING, GitRepositoryStatus.DISCONNECTED, reason);
        }
        return changed;
    }

    /**
     * GI-05 {@code installation_repositories.added}: access to the repository came back through the
     * same installation. The newest DISCONNECTED connection becomes ACTIVE again, unless another
     * project synchronizes the repository meanwhile. Returns the reactivated connection.
     */
    @Transactional
    public Optional<GitRepository> reconnect(Long installationRowId, Long externalId) {
        return connections.findByInstallation_IdAndExternalIdAndStatusIn(
                        installationRowId, externalId, EnumSet.of(GitRepositoryStatus.DISCONNECTED)).stream()
                .max((a, b) -> Long.compare(a.getId(), b.getId()))
                .filter(this::reactivate);
    }

    /**
     * DISCONNECTED/ERROR → ACTIVE after GitHub confirmed the access ("Sync again"). Stays as it is,
     * with reason {@code REPOSITORY_LINKED_ELSEWHERE}, when another connection receives the repository.
     */
    @Transactional
    public boolean reactivate(GitRepository row) {
        if (row.getStatus() == GitRepositoryStatus.ACTIVE) return true;
        if (row.getStatus() == GitRepositoryStatus.INACTIVE) return false;
        Optional<GitRepository> elsewhere = connections.findReceiving(row.getProvider(), row.getExternalId())
                .filter(other -> !other.getId().equals(row.getId()));
        if (elsewhere.isPresent()) {
            if (!GitRepositoryReason.REPOSITORY_LINKED_ELSEWHERE.equals(row.getStatusReason())) {
                row.setStatusReason(GitRepositoryReason.REPOSITORY_LINKED_ELSEWHERE);
                row.setStatusChangedAt(now());
            }
            return false;
        }
        return apply(row, EnumSet.of(GitRepositoryStatus.DISCONNECTED, GitRepositoryStatus.ERROR), GitRepositoryStatus.ACTIVE, null);
    }

    /** GI-05: a user unlinked the connection (any status but INACTIVE). Synchronized data is kept. */
    @Transactional
    public boolean unlink(GitRepository row, Long userId) {
        GitRepositoryStatus from = row.getStatus();
        if (!apply(row, GitRepositoryRepository.CURRENT, GitRepositoryStatus.INACTIVE, GitRepositoryReason.UNLINKED_BY_USER)) {
            return false;
        }
        row.setUnlinkedByUser(entityReferences.get(User.class, userId));
        row.setUnlinkedAt(row.getStatusChangedAt());
        log.info("Repository unlinked: repositoryId={}, projectId={}, externalId={}, from={}, actorUserId={}",
                row.getId(), row.getProjectId(), row.getExternalId(), from, userId);
        return true;
    }

    /**
     * SY-03 {@code repository.renamed/transferred/privatized/publicized}: keeps the stored snapshot
     * current. GI-05: for every status but INACTIVE (an unlinked connection keeps the name it had).
     */
    @Transactional
    public Optional<GitRepository> refreshSnapshot(Long repositoryId, String ownerLogin, String name, String fullName,
                                                   String htmlUrl, String visibility, String defaultBranch) {
        return connections.findById(repositoryId)
                .filter(row -> row.getStatus().holdsProject())
                .map(row -> {
                    if (ownerLogin != null) row.setOwnerLogin(ownerLogin);
                    if (name != null) row.setName(name);
                    if (fullName != null) row.setFullName(fullName);
                    if (htmlUrl != null) row.setHtmlUrl(htmlUrl);
                    if (visibility != null) row.setVisibility(visibility);
                    if (defaultBranch != null) row.setDefaultBranch(defaultBranch);
                    return row;
                });
    }

    private boolean apply(GitRepository row, Set<GitRepositoryStatus> from, GitRepositoryStatus to, String reason) {
        GitRepositoryStatus current = row.getStatus();
        if (current == to || !from.contains(current)) return false;
        row.setStatus(to);
        row.setStatusReason(reason);
        row.setStatusChangedAt(now());
        connections.saveAndFlush(row); // unique keys (active project / external) are checked here
        log.info("Repository connection transition: repositoryId={}, projectId={}, externalId={}, {} -> {}, reason={}",
                row.getId(), row.getProjectId(), row.getExternalId(), current, to, reason);
        events.publishEvent(new GitRepositoryStatusChangedEvent(row.getTenantId(), row.getId(), row.getProjectId(),
                row.getFullName(), current, to, reason));
        return true;
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }
}
