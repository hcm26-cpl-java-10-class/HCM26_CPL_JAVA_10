package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** SY-03: processes a stored event as soon as its INSERT has committed (when a handler exists). */
@Component
@RequiredArgsConstructor
public class GitWebhookEventDispatcher {

    private final GitHubAppProperties properties;
    private final GitWebhookHandlerRegistry registry;
    private final GitWebhookExecutor executor;
    private final GitWebhookEventProcessor processor;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReceived(GitWebhookEventReceived event) {
        if (!properties.isWebhookDispatchEnabled() || !registry.handles(event.eventType())) {
            return; // no handler yet (e.g. push before SY-04): it waits as RECEIVED
        }
        executor.submit(event.eventId(), () -> processor.process(event.eventId()));
    }
}
