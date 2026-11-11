package com.example.starter_project_2025.system.schedule;

import java.util.Objects;

/** Identifies an existing row, not the scope of a validation or a resource catalogue. */
public record ScheduleEntryKey(Source source, Long id) {
    public enum Source { DEMO_SESSION, STUDY_SESSION }

    public ScheduleEntryKey {
        Objects.requireNonNull(source, "Schedule entry source is required");
        if (id == null || id <= 0) throw new IllegalArgumentException("Schedule entry ID must be positive");
    }
}
