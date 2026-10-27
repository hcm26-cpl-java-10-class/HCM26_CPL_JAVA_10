package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.system.schedule.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Exposes persisted occupancy facts, without rechecking historical assignment eligibility. */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudySessionScheduleSourceAdapter implements ScheduleSessionSource {
    private final StudySessionScheduleSource source;
    private final StudySessionRepository sessions;

    @Override public ScheduleEntryKey.Source source() { return ScheduleEntryKey.Source.STUDY_SESSION; }

    @Override public ReadResult findPotentialEntries(LocalDateTime from, LocalDateTime until) {
        return ReadResult.complete(source(), source.findPotentialEntries(from, until).stream().map(row -> {
            var key = new ScheduleEntryKey(source(), row.identity().id());
            var diagnostics = new ArrayList<ScheduleScopedValidationResult.Diagnostic>();
            missing(row.classId(), "classId", key, diagnostics);
            missing(row.trainerId(), "trainerId", key, diagnostics);
            if (row.roomId() == null && (row.meetingUrl() == null || row.meetingUrl().isBlank()))
                diagnostics.add(incomplete("VENUE_DATA_MISSING", "roomId", "No explicit room ID or meeting URL", key));
            if (row.startTime() == null || row.endTime() == null)
                diagnostics.add(incomplete("TIME_DATA_MISSING", "startTime", "Schedule time is incomplete", key));
            diagnostics.add(incomplete("BLOCKING_POLICY_PENDING", "status", "StudySession blocking policy for status/isActive is not confirmed", key));
            var facts = new ScheduleCandidate(null, row.classId(), null, row.trainerId(), row.teachingAssignmentId(),
                    row.roomId(), null, row.meetingUrl(), row.title(), row.startTime(), row.endTime());
            return new Entry(key, facts, row.status() == null ? null : row.status().name(), row.isActive(), diagnostics);
        }).toList());
    }

    @Override public LookupResult lookup(ScheduleEntryKey key) {
        if (key.source() != source()) throw new IllegalArgumentException("Key belongs to another schedule source");
        return new LookupResult(key, sessions.existsById(key.id()) ? LookupStatus.FOUND : LookupStatus.NOT_FOUND, List.of());
    }

    private void missing(Long id, String field, ScheduleEntryKey key, List<ScheduleScopedValidationResult.Diagnostic> issues) {
        if (id == null || id <= 0) issues.add(incomplete("RESOURCE_ID_MISSING", field, "Explicit resource ID is missing or invalid", key));
    }

    private ScheduleScopedValidationResult.Diagnostic incomplete(String code, String field, String message, ScheduleEntryKey key) {
        return new ScheduleScopedValidationResult.Diagnostic(ScheduleScopedValidationResult.Kind.INCOMPLETE,
                code, field, message, null, null, key);
    }
}
