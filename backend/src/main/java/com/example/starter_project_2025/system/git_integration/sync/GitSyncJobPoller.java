package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * GI-04: safety net for the dispatcher. Runs due PENDING jobs (retries, jobs
 * queued while the server stopped, a full queue) and re-queues abandoned RUNNING ones.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitSyncJobPoller {

    private static final int BATCH = 20;

    private final GitHubAppProperties properties;
    private final GitSyncJobStore store;
    private final GitSyncExecutor executor;
    private final GitRepositorySyncRunner runner;

    @Scheduled(fixedDelayString = "${app.github.sync-poll-interval-ms:60000}",
            initialDelayString = "${app.github.sync-poll-interval-ms:60000}")
    public void poll() {
        if (!properties.isEnabled() || !properties.isSyncPollerEnabled()) {
            return;
        }
        int requeued = store.requeueStuck();
        if (requeued > 0) {
            log.info("Re-queued {} abandoned sync job(s)", requeued);
        }
        for (Long jobId : store.dueJobIds(BATCH)) {
            if (!executor.submit(jobId, () -> runner.run(jobId))) {
                break;
            }
        }
    }
}
