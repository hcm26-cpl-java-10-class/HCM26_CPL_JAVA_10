package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryLinkWriter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * SY-01: the one place that queues a synchronization of a repository connection ("Sync now",
 * resume, periodic reconcile). Runs under a lock of the connection row, so a connection never
 * has two jobs waiting or running at once:
 * <ol>
 *   <li>a job PENDING/RUNNING is returned as is;</li>
 *   <li>a recent success is returned as is ("Sync now" cooldown, reconcile skip);</li>
 *   <li>a PARTIAL/FAILED job with a cursor is reset and resumes where it stopped (AC05);</li>
 *   <li>a failed INITIAL job without a cursor is reset (a connection has one INITIAL job);</li>
 *   <li>otherwise a new job of the requested type is queued.</li>
 * </ol>
 */
@Component
public class GitSyncJobQueue {

    private final GitRepositoryRepository connections;
    private final GitSyncJobRepository jobs;
    private final ApplicationEventPublisher events;
    private final GitHubAppProperties properties;
    private final Clock clock;

    public GitSyncJobQueue(GitRepositoryRepository connections, GitSyncJobRepository jobs, ApplicationEventPublisher events,
                           GitHubAppProperties properties, @Qualifier("gitIntegrationClock") Clock clock) {
        this.connections = connections;
        this.jobs = jobs;
        this.events = events;
        this.properties = properties;
        this.clock = clock;
    }

    /** {@code queued = false}: an existing job was returned. Empty when the connection is not ACTIVE. */
    public record Requested(GitSyncJob job, boolean queued) {
    }

    @Transactional
    public Optional<Requested> request(Long connectionId, GitSyncJobType type, Long requestedByUserId, LocalDateTime runAt) {
        GitRepository connection = connections.lockById(connectionId)
                .filter(row -> row.getStatus() == GitRepositoryStatus.ACTIVE)
                .orElse(null);
        if (connection == null) return Optional.empty();
        LocalDateTime now = LocalDateTime.now(clock);
        GitSyncJob latest = jobs.findFirstByRepositoryIdOrderByIdDesc(connection.getId()).orElse(null);

        if (latest != null && latest.getStatus().inProgress()) return Optional.of(new Requested(latest, false));
        if (latest != null && latest.getStatus() == GitSyncJobStatus.SUCCEEDED && latest.getFinishedAt() != null
                && latest.getFinishedAt().isAfter(now.minusSeconds(recentSeconds(type)))) {
            return Optional.of(new Requested(latest, false));
        }

        GitSyncJob job = null;
        if (latest != null && latest.getCommitCursor() != null
                && (latest.getStatus() == GitSyncJobStatus.PARTIAL || latest.getStatus() == GitSyncJobStatus.FAILED)) {
            job = latest; // AC05: resume from the cursor
        } else {
            job = jobs.findByDedupeKey(GitRepositoryLinkWriter.initialDedupeKey(connection.getId()))
                    .filter(initial -> initial.getStatus() == GitSyncJobStatus.FAILED)
                    .orElse(null);
        }
        if (job != null) {
            job.setStatus(GitSyncJobStatus.PENDING);
            job.setAttemptCount(0);
            job.setNextRunAt(runAt);
            job.setStartedAt(null);
            job.setFinishedAt(null);
            job.setErrorCode(null);
            job.setErrorMessage(null);
            if (requestedByUserId != null) job.setRequestedByUserId(requestedByUserId);
        } else {
            job = GitSyncJob.builder()
                    .tenantId(connection.getTenantId())
                    .repositoryId(connection.getId())
                    .type(type)
                    .status(GitSyncJobStatus.PENDING)
                    .maxAttempts(properties.getSyncMaxAttempts())
                    .nextRunAt(runAt)
                    .requestedByUserId(requestedByUserId)
                    .build();
        }
        job = jobs.saveAndFlush(job);
        events.publishEvent(new GitSyncJobRequested(job.getId()));
        return Optional.of(new Requested(job, true));
    }

    private long recentSeconds(GitSyncJobType type) {
        return type == GitSyncJobType.SCHEDULED
                ? properties.getSyncReconcileSkipRecentMinutes() * 60
                : properties.getSyncManualCooldownSeconds();
    }
}
