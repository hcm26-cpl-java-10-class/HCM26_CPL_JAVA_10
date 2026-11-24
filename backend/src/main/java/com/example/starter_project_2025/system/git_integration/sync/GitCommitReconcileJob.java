package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

/**
 * SY-01: every 6 hours, queues a SCHEDULED sync for each ACTIVE repository so commits a failed
 * webhook missed are caught up (reading from one day before the last complete import). Only
 * queues: the sync workers do the GitHub calls. One instance at a time (ShedLock); jobs are
 * spread over {@code sync-reconcile-spread-minutes} so they do not all call GitHub at once.
 * Repositories with a job waiting or running, or synchronized within the last hour, are skipped
 * by {@link GitSyncJobQueue}; a PARTIAL job is resumed.
 */
@Slf4j
@Component
public class GitCommitReconcileJob {

    private static final int BATCH = 200;

    private final GitHubAppProperties properties;
    private final GitRepositoryRepository connections;
    private final GitSyncJobQueue queue;
    private final Clock clock;

    public GitCommitReconcileJob(GitHubAppProperties properties, GitRepositoryRepository connections, GitSyncJobQueue queue,
                                 @Qualifier("gitIntegrationClock") Clock clock) {
        this.properties = properties;
        this.connections = connections;
        this.queue = queue;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.github.sync-reconcile-cron:0 0 */6 * * *}")
    @SchedulerLock(name = "git-commit-reconcile", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void scheduled() {
        if (!properties.isEnabled() || !properties.isSyncReconcileEnabled()) return;
        int queued = reconcile();
        log.info("Commit reconcile queued {} sync job(s)", queued);
    }

    /** Queues the reconcile jobs; returns how many were queued (or resumed). */
    public int reconcile() {
        LocalDateTime now = LocalDateTime.now(clock);
        int spread = Math.max(1, properties.getSyncReconcileSpreadMinutes());
        int queued = 0;
        int index = 0;
        for (int page = 0; ; page++) {
            List<Long> ids = connections.findIdsByStatus(GitRepositoryStatus.ACTIVE, PageRequest.of(page, BATCH));
            for (Long id : ids) {
                LocalDateTime runAt = now.plusMinutes(index++ % spread);
                try {
                    if (queue.request(id, GitSyncJobType.SCHEDULED, null, runAt).map(GitSyncJobQueue.Requested::queued).orElse(false)) {
                        queued++;
                    }
                } catch (RuntimeException e) {
                    log.warn("Commit reconcile could not queue repositoryId={}: {}", id, e.getClass().getSimpleName());
                }
            }
            if (ids.size() < BATCH) return queued;
        }
    }
}
