package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.demo.session.SessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Retains the existing demo repository blocking policy; no StudySession policy is inferred. */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DemoSessionScheduleSource implements ScheduleSessionSource {
    private final SessionRepository sessions;

    @Override public ScheduleEntryKey.Source source() { return ScheduleEntryKey.Source.DEMO_SESSION; }

    @Override public ReadResult findPotentialEntries(LocalDateTime from, LocalDateTime until) {
        if (from == null || until == null || !until.isAfter(from)) throw new IllegalArgumentException("Invalid schedule range");
        return ReadResult.complete(source(), sessions.findBlockingInRange(from, until).stream().map(session -> {
            var facts = new ScheduleCandidate(null, session.getClassId(), session.getTopicId(), session.getTrainerId(),
                    session.getTeachingAssignmentId(), session.getRoomId(), session.getLocation(), session.getMeetingUrl(),
                    session.getTitle(), session.getStartTime(), session.getEndTime());
            return new Entry(new ScheduleEntryKey(source(), session.getId()), facts,
                    session.getStatus() == null ? null : session.getStatus().name(), session.getIsActive(), List.of());
        }).toList());
    }

    @Override public LookupResult lookup(ScheduleEntryKey key) {
        if (key.source() != source()) throw new IllegalArgumentException("Key belongs to another schedule source");
        return new LookupResult(key, sessions.existsById(key.id()) ? LookupStatus.FOUND : LookupStatus.NOT_FOUND, List.of());
    }
}
