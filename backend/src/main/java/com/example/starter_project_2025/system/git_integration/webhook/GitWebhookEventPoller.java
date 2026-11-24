package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.config.GitWebhookAsyncConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * SY-04 fallback path. Every {@code webhook-poll-interval-ms} (30 s) it re-queues
 * PROCESSING events whose worker vanished, then hands to the worker pool the
 * RECEIVED events the fast path did not finish within the grace period (restart,
 * discarded task) and the FAILED_RETRYABLE events whose retry time has come.
 * <p>
 * Work runs on the pool, never on the scheduler thread (shared by every
 * {@code @Scheduled} job). The race with the fast path is settled by the
 * {@code FOR UPDATE SKIP LOCKED} claim in {@link GitWebhookEventStore#claim}.
 */
@Slf4j
@Component
public class GitWebhookEventPoller {

    private static final int BATCH = 50;

    private final GitHubAppProperties properties;
    private final GitWebhookEventStore store;
    private final GitWebhookHandlerRegistry registry;
    private final GitWebhookEventProcessor processor;
    private final ThreadPoolTaskExecutor executor;

    public GitWebhookEventPoller(GitHubAppProperties properties, GitWebhookEventStore store,
                                 GitWebhookHandlerRegistry registry, GitWebhookEventProcessor processor,
                                 @Qualifier(GitWebhookAsyncConfig.WEBHOOK_EXECUTOR) ThreadPoolTaskExecutor executor) {
        this.properties = properties;
        this.store = store;
        this.registry = registry;
        this.processor = processor;
        this.executor = executor;
    }

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
        List<Long> due = store.dueIds(registry.handledTypes(), BATCH);
        int submitted = 0;
        for (Long id : due) {
            if (executor.getThreadPoolExecutor().getQueue().remainingCapacity() == 0) {
                break; // the pool is saturated: the next run continues
            }
            executor.execute(() -> processor.process(id));
            submitted++;
        }
        if (submitted > 0) {
            log.info("Fallback scheduler queued {} webhook event(s)", submitted);
        }
    }
}
