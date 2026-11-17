package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.config.GitWebhookAsyncConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * SY-04 fast path: processes a stored event on the {@code gitWebhookTaskExecutor}
 * as soon as the transaction that inserted it has committed. If the task is
 * discarded (full queue) or lost (restart), the event stays RECEIVED and the
 * {@link GitWebhookEventPoller} takes it after the grace period.
 */
@Component
@RequiredArgsConstructor
public class GitWebhookEventDispatcher {

    private final GitHubAppProperties properties;
    private final GitWebhookHandlerRegistry registry;
    private final GitWebhookEventProcessor processor;

    @Async(GitWebhookAsyncConfig.WEBHOOK_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReceived(GitWebhookEventReceived event) {
        if (!properties.isWebhookDispatchEnabled() || !registry.handles(event.eventType())) {
            return; // no handler for this type: it waits as RECEIVED
        }
        processor.process(event.eventId());
    }
}
