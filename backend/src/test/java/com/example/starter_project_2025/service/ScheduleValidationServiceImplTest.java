package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.schedule_validation.ScheduleConflictType;
import com.example.starter_project_2025.system.schedule_validation.ScheduleValidationResult;
import com.example.starter_project_2025.system.schedule_validation.ScheduleValidationServiceImpl;
import com.example.starter_project_2025.system.schedule_validation.SessionConflictCandidate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ScheduleValidationServiceImplTest {

    @Mock
    private SessionRepository sessionRepository;

    private ScheduleValidationServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ScheduleValidationServiceImpl(sessionRepository);

        lenient().when(sessionRepository.findClassConflicts(anyLong(), any(), any(), any(), any()))
                .thenReturn(List.of());
        lenient().when(sessionRepository.findTrainerConflicts(anyLong(), any(), any(), any(), any()))
                .thenReturn(List.of());
        lenient().when(sessionRepository.findRoomConflicts(any(), any(), any(), any(), any()))
                .thenReturn(List.of());
    }

    @Test
    void acceptsBackToBackSessionsInTheSameClass() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 14, 8, 0);
        SessionConflictCandidate first = candidate(1L, 10L, "A101", start, start.plusHours(2));
        SessionConflictCandidate second = candidate(1L, 11L, "A102", start.plusHours(2), start.plusHours(4));

        ScheduleValidationResult result = service.validateBatch(List.of(first, second));

        assertTrue(result.isValid());
        assertTrue(result.getConflicts().isEmpty());
    }

    @Test
    void returnsEveryRelevantConflictForPersistedSession() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 14, 8, 0);
        Session existing = Session.builder()
                .id(99L)
                .title("Existing session")
                .classId(1L)
                .trainerId(10L)
                .location("A101")
                .startTime(start.plusMinutes(30))
                .endTime(start.plusHours(2))
                .status(Session.SessionStatus.SCHEDULED)
                .build();
        SessionConflictCandidate candidate = candidate(1L, 10L, "A101", start, start.plusHours(1));

        org.mockito.Mockito.when(sessionRepository.findClassConflicts(anyLong(), any(), any(), any(), any()))
                .thenReturn(List.of(existing));
        org.mockito.Mockito.when(sessionRepository.findTrainerConflicts(anyLong(), any(), any(), any(), any()))
                .thenReturn(List.of(existing));
        org.mockito.Mockito.when(sessionRepository.findRoomConflicts(any(), any(), any(), any(), any()))
                .thenReturn(List.of(existing));

        ScheduleValidationResult result = service.validate(candidate);

        assertFalse(result.isValid());
        assertEquals(3, result.getConflicts().size());
        assertTrue(result.getConflicts().stream()
                .anyMatch(conflict -> conflict.getType() == ScheduleConflictType.CLASS_OVERLAP));
        assertTrue(result.getConflicts().stream()
                .anyMatch(conflict -> conflict.getType() == ScheduleConflictType.TRAINER_OVERLAP));
        assertTrue(result.getConflicts().stream()
                .anyMatch(conflict -> conflict.getType() == ScheduleConflictType.ROOM_OVERLAP));
    }

    @Test
    void excludesTheSessionBeingEditedFromPersistenceQueries() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 14, 8, 0);
        SessionConflictCandidate candidate = candidate(1L, 10L, "A101", start, start.plusHours(1));
        candidate.setSessionId(44L);

        service.validate(candidate);

        verify(sessionRepository).findClassConflicts(
                eq(1L), eq(start), eq(start.plusHours(1)), eq(44L), eq(Session.SessionStatus.CANCELLED));
    }

    @Test
    void findsConflictsInsideTheSameBatch() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 14, 8, 0);
        SessionConflictCandidate first = candidate(1L, 10L, "A101", start, start.plusHours(2));
        SessionConflictCandidate second = candidate(1L, 11L, "A102", start.plusHours(1), start.plusHours(3));

        ScheduleValidationResult result = service.validateBatch(List.of(first, second));

        assertFalse(result.isValid());
        assertEquals(2, result.getConflicts().size());
        assertTrue(result.getConflicts().stream()
                .allMatch(conflict -> conflict.getType() == ScheduleConflictType.CLASS_OVERLAP));
    }

    @Test
    void rejectsAnInvalidTimeRangeWithoutQueryingTheDatabase() {
        LocalDateTime start = LocalDateTime.of(2026, 10, 14, 8, 0);
        SessionConflictCandidate candidate = candidate(1L, 10L, "A101", start, start);

        ScheduleValidationResult result = service.validate(candidate);

        assertFalse(result.isValid());
        assertEquals(ScheduleConflictType.INVALID_TIME, result.getConflicts().getFirst().getType());
    }

    private SessionConflictCandidate candidate(
            Long classId,
            Long trainerId,
            String location,
            LocalDateTime startTime,
            LocalDateTime endTime) {
        return SessionConflictCandidate.builder()
                .classId(classId)
                .trainerId(trainerId)
                .location(location)
                .startTime(startTime)
                .endTime(endTime)
                .build();
    }
}
