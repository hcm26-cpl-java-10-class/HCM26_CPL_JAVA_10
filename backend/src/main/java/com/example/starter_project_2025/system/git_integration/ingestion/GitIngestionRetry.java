package com.example.starter_project_2025.system.git_integration.ingestion;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Supplier;

/**
 * SY-04: two workers may write the same commit, pull request or review at the same
 * time (two events of one PR, two pushes containing one commit). The loser's
 * transaction fails on a unique key or {@code @Version}; running the idempotent
 * ingestion again re-reads the winner's row and decides from there.
 * Call it from outside a transaction so every attempt is a new one.
 */
public final class GitIngestionRetry {

    private static final int ATTEMPTS = 5;

    private GitIngestionRetry() {
    }

    public static <T> T onConflict(Supplier<T> ingestion) {
        RuntimeException last = null;
        for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
            try {
                return ingestion.get();
            } catch (DataIntegrityViolationException | OptimisticLockingFailureException conflict) {
                last = conflict;
                pause(attempt);
            }
        }
        throw last;
    }

    /** Small random wait so writers of one row do not collide again in lockstep. */
    private static void pause(int attempt) {
        try {
            Thread.sleep(ThreadLocalRandom.current().nextLong(5, 25L * attempt));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
