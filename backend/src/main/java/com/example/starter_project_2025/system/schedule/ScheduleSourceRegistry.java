package com.example.starter_project_2025.system.schedule;

import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** Routes only by source-qualified keys; exceptions never become successful empty reads. */
@Component
public class ScheduleSourceRegistry {
    private final Map<ScheduleEntryKey.Source, ScheduleSessionSource> sources = new EnumMap<>(ScheduleEntryKey.Source.class);

    public ScheduleSourceRegistry(List<ScheduleSessionSource> providers) {
        for (var provider : providers) {
            if (sources.putIfAbsent(provider.source(), provider) != null)
                throw new IllegalArgumentException("Duplicate schedule provider: " + provider.source());
        }
    }

    public ScheduleSessionSource.ReadResult read(ScheduleEntryKey.Source source, LocalDateTime from, LocalDateTime until) {
        var provider = sources.get(source);
        if (provider == null) return ScheduleSessionSource.ReadResult.missing(source);
        try {
            var result = provider.findPotentialEntries(from, until);
            if (result == null || result.source() != source) throw new IllegalStateException("Unexpected schedule source result");
            return result;
        } catch (RuntimeException error) {
            return ScheduleSessionSource.ReadResult.unavailable(source, "Schedule source could not be read; no scheduling conclusion is possible");
        }
    }

    public ScheduleSessionSource.LookupResult lookup(ScheduleEntryKey key) {
        var provider = sources.get(key.source());
        if (provider == null) return failedLookup(key, ScheduleSessionSource.LookupStatus.MISSING_SOURCE);
        try {
            var result = provider.lookup(key);
            if (result == null || !key.equals(result.key())) throw new IllegalStateException("Unexpected schedule lookup result");
            return result;
        } catch (RuntimeException error) {
            return failedLookup(key, ScheduleSessionSource.LookupStatus.UNAVAILABLE);
        }
    }

    private ScheduleSessionSource.LookupResult failedLookup(ScheduleEntryKey key, ScheduleSessionSource.LookupStatus status) {
        return new ScheduleSessionSource.LookupResult(key, status, List.of(
                ScheduleScopedValidationResult.Diagnostic.incomplete("LOOKUP_" + status, "id", "Schedule entry existence could not be verified")));
    }
}
