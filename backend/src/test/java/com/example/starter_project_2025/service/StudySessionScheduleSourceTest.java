package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.study_session.*;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@Import(StudySessionScheduleSource.class)
class StudySessionScheduleSourceTest {
    @Autowired StudySessionRepository sessions;
    @Autowired SubjectRepository subjects;
    @Autowired StudySessionScheduleSource source;
    private Long subjectId;
    private final LocalDate date = LocalDate.of(2026, 10, 27);

    @BeforeEach
    void subject() {
        subjectId = subjects.saveAndFlush(Subject.builder().code("SS-SOURCE").name("Source test")
                .version("1.0").durationHours(30).build()).getId();
    }

    @Test
    void repositoryReturnsInclusiveDateWindowWithoutFilteringLegacyOrStatuses() {
        save(date.minusDays(1), SessionStatus.SCHEDULED, true);
        var first = save(date, SessionStatus.SCHEDULED, true);
        var cancelled = save(date, SessionStatus.CANCELLED, true);
        var inactive = save(date.plusDays(1), SessionStatus.COMPLETED, false);
        save(date.plusDays(2), SessionStatus.SCHEDULED, true);
        var found = sessions.findPotentialScheduleEntries(date, date.plusDays(1));
        assertEquals(List.of(first.getId(), cancelled.getId(), inactive.getId()), found.stream().map(StudySession::getId).toList());
        assertNull(found.getFirst().getClassId());
        assertNull(found.getFirst().getTrainerId());
        assertEquals(SessionStatus.CANCELLED, found.get(1).getStatus());
        assertEquals(SessionStatus.COMPLETED, found.get(2).getStatus());
        assertFalse(found.get(2).getIsActive());
    }

    @Test
    void sourceReturnsBroadImmutableFactsAndDoesNotImplementOverlapOrBlockingPolicy() {
        var stored = save(date, SessionStatus.CANCELLED, false);
        var from = date.atTime(12, 0);
        var until = date.atTime(13, 0);
        // Stored row is 08:00-09:00. Same-day query deliberately keeps it for the future Engine.
        var entries = source.findPotentialEntries(from, until);
        assertEquals(1, entries.size());
        var entry = entries.getFirst();
        assertEquals(stored.getId(), entry.identity().id());
        assertEquals(StudySessionScheduleIdentity.Source.STUDY_SESSION, entry.identity().source());
        assertEquals(date.atTime(8, 0), entry.startTime());
        assertEquals(date.atTime(9, 0), entry.endTime());
        assertEquals(SessionStatus.CANCELLED, entry.status());
        assertFalse(entry.isActive());
        assertNull(entry.trainerId()); // Raw legacy fact, never inferred from lecturer.
        assertNull(entry.roomId());
        assertThrows(UnsupportedOperationException.class, entries::clear);
        assertEquals(SessionStatus.CANCELLED, sessions.findById(stored.getId()).orElseThrow().getStatus());
        assertFalse(sessions.findById(stored.getId()).orElseThrow().getIsActive());
    }

    @Test
    void exclusionUsesSourceAndIdTogetherAndNeverDropsSameNumberFromAnotherSource() {
        var stored = save(date, SessionStatus.SCHEDULED, true);
        var from = date.atStartOfDay();
        var until = date.plusDays(1).atStartOfDay();
        var demo = new StudySessionScheduleIdentity(StudySessionScheduleIdentity.Source.DEMO_SESSION, stored.getId());
        var own = new StudySessionScheduleIdentity(StudySessionScheduleIdentity.Source.STUDY_SESSION, stored.getId());
        assertEquals(1, source.findPotentialEntries(from, until, demo).size());
        assertTrue(source.findPotentialEntries(from, until, own).isEmpty());
        assertEquals(1, sessions.count());
    }

    @Test
    void rejectsEmptyOrReversedWindowAndInvalidExistingIdentity() {
        LocalDateTime start = date.atStartOfDay();
        assertThrows(IllegalArgumentException.class, () -> source.findPotentialEntries(start, start));
        assertThrows(IllegalArgumentException.class, () -> source.findPotentialEntries(start, start.minusHours(1)));
        assertThrows(IllegalArgumentException.class, () -> source.findPotentialEntries(null, start));
        assertThrows(IllegalArgumentException.class, () -> new StudySessionScheduleIdentity(StudySessionScheduleIdentity.Source.STUDY_SESSION, 0L));
        assertTrue(source.findPotentialEntries(start, start.plusDays(1)).isEmpty());
    }

    private StudySession save(LocalDate day, SessionStatus status, boolean active) {
        return sessions.saveAndFlush(StudySession.builder().subjectId(subjectId).title("Source lesson")
                .sessionDate(day).startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(9, 0))
                .lecturer("Legacy lecturer").room("Legacy room").type(StudySessionType.LECTURE)
                .status(status).isActive(active).build());
    }
}
