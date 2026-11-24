package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.service.GitBranchWriter;
import com.example.starter_project_2025.system.git_integration.service.GitEntityReferences;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * SY-01: the one place that queues a synchronization of a repository connection ("Sync now",
 * resume, periodic reconcile). Runs under a lock of the connection row, so a connection never
 * has two jobs waiting or running at once:
 * <ol>
 *   <li>a job PENDING/RUNNING is returned as is;</li>
 *   <li>a recent success is returned as is ("Sync now" cooldown, reconcile skip);</li>
 *   <li>a PARTIAL/FAILED job past its metadata step is resumed by a new job that continues where it stopped
 *       (SY-01 AC05, SY-02; SY-06: the stopped job stays in the history as it ended);</li>
 *   <li>a failed INITIAL job without a cursor is run again by a new INITIAL job;</li>
 *   <li>otherwise a new job of the requested type is queued.</li>
 * </ol>
 */
@Component
public class GitSyncJobQueue {
    @Autowired
    private GitEntityReferences entityReferences;

    private final GitRepositoryRepository connections;
    private final GitSyncJobRepository jobs;
    private final ApplicationEventPublisher events;
    private final GitHubAppProperties properties;
    private final GitBranchWriter branches;
    private final Clock clock;

    public GitSyncJobQueue(GitRepositoryRepository connections, GitSyncJobRepository jobs, ApplicationEventPublisher events,
                           GitHubAppProperties properties, GitBranchWriter branches,
                           @Qualifier("gitIntegrationClock") Clock clock) {
        this.connections = connections;
        this.jobs = jobs;
        this.events = events;
        this.properties = properties;
        this.branches = branches;
        this.clock = clock;
    }

    /** {@code queued = false}: an existing job was returned. Empty when the connection is not ACTIVE or ERROR. */
    public record Requested(GitSyncJob job, boolean queued) {
    }

    @Transactional
    public Optional<Requested> request(Long connectionId, GitSyncJobType type, Long requestedByUserId, LocalDateTime runAt) {
        GitRepository connection = connections.lockById(connectionId)
                .filter(row -> row.getStatus().receivesEvents()) // GI-05: ERROR may sync (a success clears it)
                .orElse(null);
        if (connection == null) return Optional.empty();
        LocalDateTime now = LocalDateTime.now(clock);
        GitSyncJob latest = jobs.findFirstByRepository_IdOrderByIdDesc(connection.getId()).orElse(null);

        if (latest != null && latest.getStatus().inProgress()) return Optional.of(new Requested(latest, false));
        if (latest != null && latest.getStatus() == GitSyncJobStatus.SUCCEEDED && latest.getFinishedAt() != null
                && latest.getFinishedAt().isAfter(now.minusSeconds(recentSeconds(type)))) {
            return Optional.of(new Requested(latest, false));
        }

        GitSyncJob job = newJob(connection, type, requestedByUserId, runAt);
        if (latest != null && resumable(latest)) {
            // SY-06 (BR1): a resume is a new synchronization; the stopped one keeps its result in the history.
            resumeFrom(job, latest);
        } else if (latest != null && latest.getType() == GitSyncJobType.INITIAL && latest.getStatus() == GitSyncJobStatus.FAILED) {
            // A failed first import without a cursor runs again as an initial import (whole history).
            job.setType(GitSyncJobType.INITIAL);
            job.setResumedFromJob(entityReferences.get(GitSyncJob.class, latest.getId()));
        }
        if (type == GitSyncJobType.MANUAL && job.getResumedFromJob() == null) {
            // SY-07: "Sync now" reads again the branches an earlier sync cut at the page cap (it may have been raised).
            branches.resetTruncated(connection.getId());
        }
        job = jobs.saveAndFlush(job);
        events.publishEvent(new GitSyncJobRequested(job.getId()));
        return Optional.of(new Requested(job, true));
    }

    private GitSyncJob newJob(GitRepository connection, GitSyncJobType type, Long requestedByUserId, LocalDateTime runAt) {
        return GitSyncJob.builder()
                .tenant(entityReferences.get(Tenant.class, connection.getTenantId()))
                .repository(entityReferences.get(GitRepository.class, connection.getId()))
                .type(type)
                .status(GitSyncJobStatus.PENDING)
                .maxAttempts(properties.getSyncMaxAttempts())
                .nextRunAt(runAt)
                .requestedByUser(entityReferences.get(User.class, requestedByUserId))
                .build();
    }

    /**
     * The new job continues at the step, window and cursors where {@code stopped} ended; its page
     * counters start at 0 so PARTIAL / FAILED describe this run. The stopped job is left as it ended;
     * only the latest job of a connection is ever resumed, so it is not resumed twice.
     */
    private static void resumeFrom(GitSyncJob job, GitSyncJob stopped) {
        job.setResumedFromJob(stopped);
        job.setPhase(stopped.getPhase());
        job.setCommitCursor(stopped.getCommitCursor());
        job.setCommitSince(stopped.getCommitSince());
        job.setCommitBranch(stopped.getCommitBranch());
        job.setCommitHeadOid(stopped.getCommitHeadOid());
        job.setPrCursor(stopped.getPrCursor());
        job.setPrSince(stopped.getPrSince());
        // SY-07: the branches finished by the stopped job are marked in git_branches; the one it was
        // reading continues from its cursor (the listing is done again only if it was not finished).
        job.setBranchListDone(stopped.getBranchListDone());
        job.setBranchName(stopped.getBranchName());
        job.setBranchCursor(stopped.getBranchCursor());
        job.setBranchCurrentPages(stopped.getBranchCurrentPages());
    }

    /** A stopped job that got past its metadata step keeps its step, window and cursors: resuming continues it. */
    public static boolean resumable(GitSyncJob job) {
        boolean stopped = job.getStatus() == GitSyncJobStatus.PARTIAL || job.getStatus() == GitSyncJobStatus.FAILED;
        boolean progressed = job.getCommitCursor() != null || job.getPrCursor() != null
                || job.getPhase() == GitSyncPhase.BRANCHES || job.getPhase() == GitSyncPhase.PULL_REQUESTS;
        return stopped && progressed;
    }

    private long recentSeconds(GitSyncJobType type) {
        return type == GitSyncJobType.SCHEDULED
                ? properties.getSyncReconcileSkipRecentMinutes() * 60
                : properties.getSyncManualCooldownSeconds();
    }
}
