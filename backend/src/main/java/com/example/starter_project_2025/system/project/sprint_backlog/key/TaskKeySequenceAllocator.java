package com.example.starter_project_2025.system.project.sprint_backlog.key;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;

/**
 * Hands out Task ID numbers per (tenant, prefix).
 * <p>
 * Every reservation runs in its own short transaction ({@code REQUIRES_NEW}): the
 * counter row is locked only for the few milliseconds of the {@code UPDATE}, never
 * for the whole (possibly long) transaction that creates the items. A number taken
 * by a transaction that later rolls back is simply skipped: keys are unique and
 * increasing, not gap-free.
 */
@Component
public class TaskKeySequenceAllocator {

    private static final int ATTEMPTS = 3;

    private final BacklogTaskKeySequenceRepository sequences;
    private final TransactionTemplate requiresNew;

    public TaskKeySequenceAllocator(BacklogTaskKeySequenceRepository sequences,
                                    PlatformTransactionManager transactionManager) {
        this.sequences = sequences;
        this.requiresNew = new TransactionTemplate(transactionManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Reserves {@code count} consecutive numbers and returns the first one. */
    public long allocate(long tenantId, String prefix, int count) {
        if (count < 1) throw new IllegalArgumentException("count must be positive");
        return retryOnRace(() -> requiresNew.execute(status -> reserveOrCreate(tenantId, prefix, count)));
    }

    /** Makes sure the counter only hands out numbers {@code >= floor} (legacy backfill). */
    public void raiseTo(long tenantId, String prefix, long floor) {
        retryOnRace(() -> requiresNew.execute(status -> {
            LocalDateTime now = LocalDateTime.now();
            if (sequences.raiseTo(tenantId, prefix, floor, now) == 0
                    && sequences.findByTenantIdAndPrefix(tenantId, prefix).isEmpty()) {
                sequences.saveAndFlush(new BacklogTaskKeySequence(tenantId, prefix, floor, now));
            }
            return 0L;
        }));
    }

    private long reserveOrCreate(long tenantId, String prefix, int count) {
        LocalDateTime now = LocalDateTime.now();
        if (sequences.reserve(tenantId, prefix, count, now) == 1) {
            return sequences.findByTenantIdAndPrefix(tenantId, prefix).orElseThrow().getNextNumber() - count;
        }
        sequences.saveAndFlush(new BacklogTaskKeySequence(tenantId, prefix, 1L + count, now));
        return 1L;
    }

    /** Two first reservations of a new prefix race on the insert; the loser retries the update. */
    private long retryOnRace(java.util.function.Supplier<Long> work) {
        DataIntegrityViolationException last = null;
        for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
            try {
                return work.get();
            } catch (DataIntegrityViolationException race) {
                last = race;
            }
        }
        throw last;
    }
}
