package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** GI-04: starts a queued sync job as soon as the transaction that created it has committed. */
@Component
@RequiredArgsConstructor
public class GitSyncJobDispatcher {

    private final GitHubAppProperties properties;
    private final GitSyncExecutor executor;
    private final GitRepositorySyncRunner runner;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRequested(GitSyncJobRequested event) {
        if (!properties.isEnabled() || !properties.isSyncDispatchEnabled()) {
            return; // the poller (or a test) runs it
        }
        executor.submit(event.jobId(), () -> runner.run(event.jobId()));
    }
}
