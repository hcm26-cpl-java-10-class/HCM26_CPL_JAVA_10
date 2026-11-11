package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.demo.session.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ScheduleValidationEngineTest {
    SessionRepository sessions;
    ScheduleReferenceProvider references;
    ScheduleValidationEngine service;
    ScheduleRules rules;
    ScheduleReferences fixtures;

    @BeforeEach void setup() {
        sessions = mock(SessionRepository.class);
        references = mock(ScheduleReferenceProvider.class);
        rules = new ScheduleRules();
        fixtures = new DemoScheduleReferenceProvider().load();
        when(references.load()).thenReturn(fixtures);
        when(sessions.existsById(anyLong())).thenReturn(true);
        when(sessions.findBlockingInRange(any(), any())).thenReturn(List.of());
        var locks = mock(ScheduleWriteLockRepository.class);
        when(locks.acquire()).thenReturn(Optional.of(new ScheduleWriteLock(1L)));
        service = new ScheduleValidationEngine(sessions, references, rules, locks);
    }

    ScheduleCandidate candidate(Long id, Long clazz, Long trainer, Long room, String start, String end) {
        return new ScheduleCandidate(id, clazz, 1L, trainer, null, room, null, null, "Java", LocalDateTime.parse(start), LocalDateTime.parse(end));
    }
    ScheduleCandidate standard() { return candidate(null, 1L, 1L, 1L, "2026-10-21T09:00", "2026-10-21T10:00"); }
    Session old(ScheduleCandidate c) {
        return Session.builder().id(c.id() == null ? 50L : c.id()).classId(c.classId()).topicId(c.topicId())
                .trainerId(c.trainerId()).roomId(c.roomId()).location(c.location()).title(c.title())
                .startTime(c.startTime()).endTime(c.endTime()).status(Session.SessionStatus.SCHEDULED).isActive(true).build();
    }
    Set<String> codes(ScheduleValidationResult r) { return new HashSet<>(r.issues().stream().map(ScheduleIssue::code).toList()); }

    @Test void validSession() { assertTrue(service.validate(List.of(standard())).valid()); }
    @ParameterizedTest @CsvSource({"09:00,10:00,true", "09:30,10:30,true", "08:00,09:00,false", "10:00,11:00,false", "08:00,11:00,true"})
    void overlapAndAdjacent(String from, String to, boolean overlap) {
        when(sessions.findBlockingInRange(any(), any())).thenReturn(List.of(old(candidate(50L, 1L, 1L, 1L, "2026-10-21T"+from, "2026-10-21T"+to))));
        var result = service.validate(List.of(standard()));
        assertEquals(overlap, !result.valid());
        if (overlap) {
            assertTrue(codes(result).containsAll(Set.of("CLASS_CONFLICT", "TRAINER_CONFLICT", "ROOM_CONFLICT")));
            assertEquals(50L, result.issues().getFirst().relatedSessionId());
        }
    }
    @Test void updatingExcludesOldSelf() {
        var c = candidate(50L, 1L, 1L, 1L, "2026-10-21T09:00", "2026-10-21T10:00");
        when(sessions.findBlockingInRange(any(), any())).thenReturn(List.of(old(c)));
        assertTrue(service.validate(List.of(c)).valid());
    }
    @Test void changingTimeStillChecksOtherSessions() {
        var c = candidate(50L, 1L, 1L, 1L, "2026-10-21T09:00", "2026-10-21T10:00");
        when(sessions.findBlockingInRange(any(), any())).thenReturn(List.of(old(c), old(candidate(51L, 2L, 2L, 1L, "2026-10-21T09:00", "2026-10-21T10:00"))));
        var r = service.validate(List.of(c));
        assertEquals(Set.of("ROOM_CONFLICT"), codes(r));
        assertEquals(51L, r.issues().getFirst().relatedSessionId());
    }
    @Test void batchConflictsIncludeBothRows() {
        var result = service.validate(List.of(standard(), standard()));
        assertEquals(6, result.issues().size());
        assertTrue(result.issues().stream().anyMatch(i -> i.candidateIndex()==0 && Objects.equals(i.relatedCandidateIndex(),1)));
        assertTrue(result.issues().stream().anyMatch(i -> i.candidateIndex()==1 && Objects.equals(i.relatedCandidateIndex(),0)));
    }
    @Test void batchUpdateExcludesAllReplacedRowsAndChecksNewPairs() {
        var first = candidate(50L,1L,1L,1L,"2026-10-21T09:00","2026-10-21T10:00");
        var second = candidate(51L,1L,1L,1L,"2026-10-21T10:00","2026-10-21T11:00");
        when(sessions.findBlockingInRange(any(),any())).thenReturn(List.of(old(first),old(second)));
        assertTrue(service.validate(List.of(first,second)).valid());
    }
    @Test void roomNamesUseSharedCanonicalId() {
        var old = old(candidate(50L,2L,2L,null,"2026-10-21T09:00","2026-10-21T10:00"));
        old.setLocation(" a101 ");
        when(sessions.findBlockingInRange(any(),any())).thenReturn(List.of(old));
        assertEquals(Set.of("ROOM_CONFLICT"),codes(service.validate(List.of(standard()))));
    }
    @Test void onlineSessionsDoNotConflictOnMissingRooms() {
        var a = new ScheduleCandidate(null,1L,1L,1L,null,null,"","https://meet.example/a","A",standard().startTime(),standard().endTime());
        var b = new ScheduleCandidate(null,2L,1L,2L,null,null,"","https://meet.example/b","B",standard().startTime(),standard().endTime());
        assertTrue(service.validate(List.of(a,b)).valid());
    }
    @Test void detectsHolidays() {
        assertTrue(codes(service.validate(List.of(candidate(null,1L,1L,1L,"2026-11-20T09:00","2026-11-20T10:00")))).contains("HOLIDAY"));
    }
    @Test void detectsClassDates() {
        assertTrue(codes(service.validate(List.of(candidate(null,1L,1L,1L,"2028-01-01T09:00","2028-01-01T10:00")))).contains("CLASS_DATE_RANGE"));
    }
    @Test void detectsWorkingHoursAndOvernight() {
        assertTrue(codes(service.validate(List.of(candidate(null,1L,1L,1L,"2026-10-21T06:00","2026-10-21T08:00")))).contains("WORKING_HOURS"));
        assertTrue(codes(service.validate(List.of(candidate(null,1L,1L,1L,"2026-10-21T21:00","2026-10-22T08:00")))).contains("WORKING_HOURS"));
        rules.setWorkingDays(Set.of(1));
        assertTrue(codes(service.validate(List.of(standard()))).contains("WORKING_HOURS"));
    }
    @Test void invalidOrderIsRejectedBeforeCallingReferences() {
        assertTrue(codes(service.validate(List.of(candidate(null,1L,1L,1L,"2026-10-21T10:00","2026-10-21T10:00")))).contains("TIME_ORDER"));
        verifyNoInteractions(references);
    }
    @Test void inactiveTrainerAndWrongAssignmentAreRejected() {
        fixtures.trainers().getFirst().setStatus("INACTIVE");
        assertTrue(codes(service.validate(List.of(standard()))).contains("TRAINER_INACTIVE"));
        assertTrue(codes(service.validate(List.of(candidate(null,1L,2L,1L,"2026-10-21T09:00","2026-10-21T10:00")))).contains("ASSIGNMENT_INVALID"));
    }
    @Test void unknownRoomAndMissingVenueAreRejected() {
        assertTrue(codes(service.validate(List.of(candidate(null,1L,1L,999L,"2026-10-21T09:00","2026-10-21T10:00")))).contains("ROOM_NOT_FOUND"));
        assertTrue(codes(service.validate(List.of(candidate(null,1L,1L,null,"2026-10-21T09:00","2026-10-21T10:00")))).contains("VENUE_REQUIRED"));
    }
    @Test void assignmentMustCoverEntireSession() {
        when(references.load()).thenReturn(new ScheduleReferences(fixtures.classes(),fixtures.trainers(),fixtures.rooms(),
                List.of(new ScheduleReferences.Assignment(1L,1L,1L,1L,LocalDate.of(2026,10,22),null,"ACTIVE")),fixtures.holidays()));
        assertTrue(codes(service.validate(List.of(standard()))).contains("ASSIGNMENT_INVALID"));
    }
    @Test void missingEditIdAndDuplicateIdsCannotSilentlyExcludeData() {
        when(sessions.existsById(50L)).thenReturn(false);
        var c=candidate(50L,1L,1L,1L,"2026-10-21T09:00","2026-10-21T10:00");
        assertTrue(codes(service.validate(List.of(c,c))).containsAll(Set.of("NOT_FOUND","DUPLICATE_ID")));
    }
    @Test void emptyAndOversizedBatchesAreRejected() {
        assertEquals(Set.of("BATCH_SIZE"), codes(service.validate(List.of())));
        assertEquals(Set.of("BATCH_SIZE"), codes(service.validate(Collections.nCopies(201,standard()))));
    }
    @Test void referenceOutageDoesNotPassValidation() {
        when(references.load()).thenThrow(new IllegalStateException("Unavailable"));
        assertThrows(IllegalStateException.class, () -> service.validate(List.of(standard())));
    }
    @Test void activationCanReplaceOldActiveButStillChecksOtherClasses() {
        when(sessions.findBlockingInRange(any(),any())).thenReturn(List.of(old(standard())));
        assertDoesNotThrow(() -> service.requireValidActivation(List.of(standard()),Set.of(50L)));
        assertThrows(ScheduleValidationException.class, () -> service.requireValidActivation(List.of(standard()),Set.of()));
    }
}
