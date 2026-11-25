package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.ingestion.event.CommitIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.PullRequestIngestedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * SY-05 fast path: as soon as SY-04 has stored new commits or a newer pull request,
 * their Task IDs are linked (on the same webhook worker thread, in a new transaction).
 * A failure never touches the webhook event: {@link GitTaskLinkSweeper} catches up.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitTaskLinkListener {

    private final GitTaskLinker linker;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCommits(CommitIngestedEvent event) {
        try {
            linker.linkCommits(event.commitIds());
        } catch (RuntimeException failure) {
            log.warn("Task links of {} commit(s) of repository {} not created now; the sweeper will retry",
                    event.commitIds().size(), event.repositoryId(), failure);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPullRequest(PullRequestIngestedEvent event) {
        try {
            linker.linkPullRequest(event.pullRequestId());
        } catch (RuntimeException failure) {
            log.warn("Task links of pull request #{} of repository {} not updated now; the sweeper will retry",
                    event.number(), event.repositoryId(), failure);
        }
    }
}
