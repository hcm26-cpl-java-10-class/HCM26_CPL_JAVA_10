package com.example.starter_project_2025.system.schedule;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Server-side proposals only. Does not check existence, authorization or eligibility. */
public record ScheduleValidationBatch(List<Item> candidates) {
    /** Null replacedKey means create; an Edit key must come from a trusted server lookup. */
    public record Item(ScheduleCandidate candidate, ScheduleEntryKey replacedKey) {
        public Item {
            Objects.requireNonNull(candidate, "Candidate is required");
            if (candidate.id() != null)
                throw new IllegalArgumentException("Use replacedKey, not an unscoped candidate ID");
        }
    }

    public ScheduleValidationBatch {
        candidates = List.copyOf(candidates);
        var keys = new HashSet<ScheduleEntryKey>();
        for (var item : candidates) {
            if (item.replacedKey() != null && !keys.add(item.replacedKey()))
                throw new IllegalArgumentException("Duplicate replacement key: " + item.replacedKey());
        }
        // Batch size and candidate business rules remain the Engine's responsibility.
    }

    public Set<ScheduleEntryKey> replacedKeys() {
        var keys = new HashSet<ScheduleEntryKey>();
        candidates.forEach(item -> { if (item.replacedKey() != null) keys.add(item.replacedKey()); });
        return Set.copyOf(keys);
    }
}
