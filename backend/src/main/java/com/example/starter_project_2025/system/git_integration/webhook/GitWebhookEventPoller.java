package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * SY-03: safety net for the dispatcher. Retries FAILED events when due, runs
 * RECEIVED events that were never dispatched (server restart, full queue, a
 * handler deployed later) and re-queues abandoned PROCESSING ones.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitWebhookEventPoller {

    private static final int BATCH = 50;

    private final GitHubAppProperties properties;
    private final GitWebhookEventStore store;
    private final GitWebhookHandlerRegistry registry;
    private final GitWebhookExecutor executor;
    private final GitWebhookEventProcessor processor;

    @Scheduled(fixedDelayString = "${app.github.webhook-poll-interval-ms:30000}",
            initialDelayString = "${app.github.webhook-poll-interval-ms:30000}")
    public void poll() {
        if (!properties.isWebhookPollerEnabled()) {
            return;
        }
        int requeued = store.requeueStuck();
        if (requeued > 0) {
            log.info("Re-queued {} abandoned webhook event(s)", requeued);
        }
        for (Long id : store.dueIds(registry.handledTypes(), BATCH)) {
            if (!executor.submit(id, () -> processor.process(id))) {
                break;
            }
        }
    }
}
