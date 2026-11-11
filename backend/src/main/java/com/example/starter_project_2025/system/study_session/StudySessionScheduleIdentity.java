package com.example.starter_project_2025.system.study_session;

import java.util.Objects;

/** Local preparation contract, pending agreement with the schedule module owner. */
public record StudySessionScheduleIdentity(Source source, Long id) {
    public enum Source { STUDY_SESSION, DEMO_SESSION }

    public StudySessionScheduleIdentity {
        Objects.requireNonNull(source, "Schedule source is required");
        if (id == null || id <= 0) throw new IllegalArgumentException("An existing schedule entry needs a positive ID");
    }
}
