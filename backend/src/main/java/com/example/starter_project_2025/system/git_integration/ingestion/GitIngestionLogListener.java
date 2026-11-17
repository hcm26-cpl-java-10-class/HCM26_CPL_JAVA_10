package com.example.starter_project_2025.system.git_integration.ingestion;

import com.example.starter_project_2025.system.git_integration.ingestion.event.CommitIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.PullRequestIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.ReviewIngestedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * SY-04: placeholder consumer of the ingestion events until the Analytics module
 * subscribes; shows the AFTER_COMMIT contract and leaves a debug trace.
 */
@Slf4j
@Component
public class GitIngestionLogListener {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCommits(CommitIngestedEvent event) {
        log.debug("Commits ingested: repositoryId={}, ref={}, count={}", event.repositoryId(), event.ref(), event.commitIds().size());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPullRequest(PullRequestIngestedEvent event) {
        log.debug("Pull request ingested: repositoryId={}, #{}, action={}, state={}, created={}",
                event.repositoryId(), event.number(), event.action(), event.state(), event.created());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReview(ReviewIngestedEvent event) {
        log.debug("Review ingested: repositoryId={}, pullRequestId={}, state={}, action={}, created={}",
                event.repositoryId(), event.pullRequestId(), event.state(), event.action(), event.created());
    }
}
