package com.example.starter_project_2025.system.git_integration.sync;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * GI-04: small dedicated pool for sync jobs. Deliberately not an
 * {@link java.util.concurrent.Executor} bean, so it never replaces Spring's
 * default executor used by other {@code @Async} code.
 */
@Slf4j
@Component
public class GitSyncExecutor {

    private final AtomicInteger threads = new AtomicInteger();
    private final ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 2, 60, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(100), runnable -> {
                Thread thread = new Thread(runnable, "git-sync-" + threads.incrementAndGet());
                thread.setDaemon(true);
                return thread;
            });

    /** False when the queue is full; the poller picks the job up later. */
    public boolean submit(Long jobId, Runnable task) {
        try {
            pool.execute(task);
            return true;
        } catch (RejectedExecutionException e) {
            log.warn("Sync queue full, job {} left for the poller", jobId);
            return false;
        }
    }

    @PreDestroy
    void shutdown() {
        pool.shutdown();
    }
}
