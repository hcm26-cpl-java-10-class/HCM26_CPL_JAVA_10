package com.example.starter_project_2025.system.git_integration.webhook;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * SY-03: small dedicated pool for webhook processing. Deliberately not an
 * {@link java.util.concurrent.Executor} bean, so it never replaces Spring's
 * default executor used by other {@code @Async} code.
 */
@Slf4j
@Component
public class GitWebhookExecutor {

    private final AtomicInteger threads = new AtomicInteger();
    private final ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 2, 60, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(200), runnable -> {
                Thread thread = new Thread(runnable, "git-webhook-" + threads.incrementAndGet());
                thread.setDaemon(true);
                return thread;
            });

    /** False when the queue is full; the poller picks the event up later. */
    public boolean submit(Long eventId, Runnable task) {
        try {
            pool.execute(task);
            return true;
        } catch (RejectedExecutionException e) {
            log.warn("Webhook queue full, event {} left for the poller", eventId);
            return false;
        }
    }

    @PreDestroy
    void shutdown() {
        pool.shutdown();
    }
}
