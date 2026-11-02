package com.example.starter_project_2025.system.schedule;

import java.time.LocalDateTime;
import java.util.List;
import java.util.HashSet;
import java.util.Objects;

/**
 * Read-only seam, not registered with the Engine yet. Range reads may overfetch, must not
 * silently omit uncertain rows, and must not turn lookup failures into successful empty reads.
 * No blocking, active, topic or venue policy is selected by this interface.
 */
public interface ScheduleSessionSource {
    ScheduleEntryKey.Source source();

    /** Implementations must reject null/reversed/empty bounds; exact overlap stays in the Engine. */
    ReadResult findPotentialEntries(LocalDateTime from, LocalDateTime until);

    /**
     * Look up by this source and ID, independently of blocking/status filters. Implementations
     * must reject keys owned by another source. NOT_FOUND requires a successful lookup;
     * failures must return UNAVAILABLE/MISSING_SOURCE or propagate, never return NOT_FOUND.
     */
    LookupResult lookup(ScheduleEntryKey key);

    /** Raw facts. Null resource/time fields must be explained if their meaning is unknown. */
    record Entry(ScheduleEntryKey key, ScheduleCandidate facts, String rawStatus, Boolean isActive,
                 List<ScheduleScopedValidationResult.Diagnostic> diagnostics) {
        public Entry {
            Objects.requireNonNull(key, "Entry key is required");
            Objects.requireNonNull(facts, "Entry facts are required");
            if (facts.id() != null) throw new IllegalArgumentException("Entry identity belongs in its source-qualified key");
            diagnostics = List.copyOf(diagnostics);
        }
    }

    enum ReadStatus { COMPLETE, INCOMPLETE, UNAVAILABLE, MISSING_SOURCE }

    /** COMPLETE means the read succeeded, not that its entries or proposed writes are valid. */
    record ReadResult(ScheduleEntryKey.Source source, ReadStatus status, List<Entry> entries,
                      List<ScheduleScopedValidationResult.Diagnostic> diagnostics) {
        public ReadResult {
            Objects.requireNonNull(source, "Source is required");
            Objects.requireNonNull(status, "Read status is required");
            entries = List.copyOf(entries);
            diagnostics = List.copyOf(diagnostics);
            if (entries.stream().anyMatch(entry -> entry.key().source() != source))
                throw new IllegalArgumentException("A source cannot return another source's entries");
            var keys = new HashSet<ScheduleEntryKey>();
            for (var entry : entries) {
                if (!keys.add(entry.key())) throw new IllegalArgumentException("Duplicate source entry key: " + entry.key());
            }
            if (status == ReadStatus.COMPLETE && !diagnostics.isEmpty())
                throw new IllegalArgumentException("A complete read cannot carry read-level failures");
            if (status != ReadStatus.COMPLETE && diagnostics.stream().noneMatch(d -> d.kind() == ScheduleScopedValidationResult.Kind.INCOMPLETE))
                throw new IllegalArgumentException("An incomplete/failed read needs an INCOMPLETE diagnostic");
            if ((status == ReadStatus.UNAVAILABLE || status == ReadStatus.MISSING_SOURCE) && !entries.isEmpty())
                throw new IllegalArgumentException("Use INCOMPLETE to retain partially read entries");
        }

        public static ReadResult complete(ScheduleEntryKey.Source source, List<Entry> entries) {
            return new ReadResult(source, ReadStatus.COMPLETE, entries, List.of());
        }

        public static ReadResult unavailable(ScheduleEntryKey.Source source, String message) {
            return new ReadResult(source, ReadStatus.UNAVAILABLE, List.of(), List.of(
                    ScheduleScopedValidationResult.Diagnostic.incomplete("SOURCE_UNAVAILABLE", source.name(), message)));
        }

        public static ReadResult missing(ScheduleEntryKey.Source source) {
            return new ReadResult(source, ReadStatus.MISSING_SOURCE, List.of(), List.of(
                    ScheduleScopedValidationResult.Diagnostic.incomplete("SOURCE_MISSING", source.name(), "Required schedule source was not supplied")));
        }
    }

    enum LookupStatus { FOUND, NOT_FOUND, UNAVAILABLE, MISSING_SOURCE }

    record LookupResult(ScheduleEntryKey key, LookupStatus status,
                        List<ScheduleScopedValidationResult.Diagnostic> diagnostics) {
        public LookupResult {
            Objects.requireNonNull(key, "Lookup key is required");
            Objects.requireNonNull(status, "Lookup status is required");
            diagnostics = List.copyOf(diagnostics);
            boolean failed = status == LookupStatus.UNAVAILABLE || status == LookupStatus.MISSING_SOURCE;
            if (failed && diagnostics.stream().noneMatch(d -> d.kind() == ScheduleScopedValidationResult.Kind.INCOMPLETE))
                throw new IllegalArgumentException("Lookup failure needs an INCOMPLETE diagnostic");
            if (!failed && !diagnostics.isEmpty())
                throw new IllegalArgumentException("Successful existence lookup cannot carry failure diagnostics");
        }
    }
}
