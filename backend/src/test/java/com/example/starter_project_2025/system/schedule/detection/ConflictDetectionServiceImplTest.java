package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictDTO;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConflictDetectionServiceImplTest {

    private static final Long VERSION_ID = 20L;
    private static final Long TARGET_CLASS_ID = 1001L;
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 10, 20);

    private CalendarVersionRepository calendarVersionRepository;
    private ConflictDetectionRepository conflictDetectionRepository;
    private ConflictDetectionServiceImpl service;

    @BeforeEach
    void setUp() {
        calendarVersionRepository = mock(CalendarVersionRepository.class);
        conflictDetectionRepository = mock(ConflictDetectionRepository.class);
        ConflictDetectionMapper mapper = mock(ConflictDetectionMapper.class);

        Calendar calendar = Calendar.builder()
                .id(10L)
                .classId(TARGET_CLASS_ID)
                .name("Java 01")
                .isActive(true)
                .build();
        CalendarVersion draft = CalendarVersion.builder()
                .id(VERSION_ID)
                .calendar(calendar)
                .versionNumber(2)
                .status(CalendarVersionStatus.DRAFT)
                .isActive(true)
                .build();

        when(calendarVersionRepository.findById(VERSION_ID)).thenReturn(Optional.of(draft));
        when(conflictDetectionRepository.findSessionsInDraft(VERSION_ID)).thenReturn(List.of());
        when(conflictDetectionRepository.findSessionsInActiveVersionsOfOtherClasses(TARGET_CLASS_ID))
                .thenReturn(List.of());
        when(mapper.toDto(any(Session.class), any(Session.class), any(Set.class)))
                .thenAnswer(invocation -> conflictDto(
                        invocation.getArgument(0),
                        invocation.getArgument(1),
                        invocation.getArgument(2)
                ));

        service = new ConflictDetectionServiceImpl(
                calendarVersionRepository,
                conflictDetectionRepository,
                mapper
        );
    }

    @Test
    void shouldApplyHalfOpenIntervalOverlapRules() {
        assertPairConflict(time(9, 0), time(11, 0), time(10, 0), time(12, 0), true);
        assertPairConflict(time(9, 0), time(11, 0), time(11, 0), time(12, 0), false);
        assertPairConflict(time(9, 0), time(12, 0), time(10, 0), time(11, 0), true);
        assertPairConflict(time(9, 0), time(11, 0), time(9, 0), time(11, 0), true);
    }

    @Test
    void shouldNotConflictWhenTimesMatchOnDifferentDates() {
        Session first = session(1L, 1L, "R01", time(9, 0), time(11, 0));
        Session second = session(
                2L,
                1L,
                "R01",
                time(9, 0).plusDays(1),
                time(11, 0).plusDays(1)
        );
        when(conflictDetectionRepository.findSessionsInDraft(VERSION_ID))
                .thenReturn(List.of(first, second));

        ConflictCheckResult result = service.checkConflicts(VERSION_ID);

        assertFalse(result.isHasConflict());
        assertTrue(result.getConflicts().isEmpty());
    }

    @Test
    void shouldDetectExpectedPairsWithinDraft() {
        Session s01 = session(1L, 1L, "R01", time(9, 0), time(11, 0));
        Session s02 = session(2L, 1L, "R02", time(10, 0), time(12, 0));
        Session s03 = session(3L, 2L, " r01 ", time(10, 0), time(12, 0));
        when(conflictDetectionRepository.findSessionsInDraft(VERSION_ID))
                .thenReturn(List.of(s01, s02, s03));

        ConflictCheckResult result = service.checkConflicts(VERSION_ID);

        assertTrue(result.isHasConflict());
        assertEquals(2, result.getConflicts().size());
        assertEquals(EnumSet.of(ConflictType.TRAINER_CONFLICT),
                result.getConflicts().get(0).getConflictTypes());
        assertEquals(EnumSet.of(ConflictType.ROOM_CONFLICT),
                result.getConflicts().get(1).getConflictTypes());
    }

    @Test
    void shouldReturnBothTypesWhenTrainerAndRoomConflict() {
        Session first = session(1L, 1L, "R01", time(9, 0), time(11, 0));
        Session second = session(2L, 1L, "r01", time(10, 0), time(12, 0));
        when(conflictDetectionRepository.findSessionsInDraft(VERSION_ID))
                .thenReturn(List.of(first, second));

        ConflictCheckResult result = service.checkConflicts(VERSION_ID);

        assertEquals(EnumSet.of(
                        ConflictType.TRAINER_CONFLICT,
                        ConflictType.ROOM_CONFLICT
                ),
                result.getConflicts().get(0).getConflictTypes());
    }

    @Test
    void shouldNotTreatBlankRoomsAsTheSameRoom() {
        Session first = session(1L, 1L, " ", time(9, 0), time(11, 0));
        Session second = session(2L, 2L, "", time(10, 0), time(12, 0));
        when(conflictDetectionRepository.findSessionsInDraft(VERSION_ID))
                .thenReturn(List.of(first, second));

        ConflictCheckResult result = service.checkConflicts(VERSION_ID);

        assertFalse(result.isHasConflict());
    }

    @Test
    void shouldDetectDraftAgainstActiveVersionOfAnotherClass() {
        Session draftSession = session(1L, 1L, "R01", time(9, 0), time(11, 0));
        Session otherClassActive = session(10L, 1L, "R02", time(10, 0), time(12, 0));
        when(conflictDetectionRepository.findSessionsInDraft(VERSION_ID))
                .thenReturn(List.of(draftSession));
        when(conflictDetectionRepository.findSessionsInActiveVersionsOfOtherClasses(TARGET_CLASS_ID))
                .thenReturn(List.of(otherClassActive));

        ConflictCheckResult result = service.checkConflicts(VERSION_ID);

        assertTrue(result.isHasConflict());
        assertEquals(1, result.getConflicts().size());
        assertEquals(EnumSet.of(ConflictType.TRAINER_CONFLICT),
                result.getConflicts().get(0).getConflictTypes());
        assertEquals(1L, result.getConflicts().get(0).getSession().getId());
        assertEquals(10L, result.getConflicts().get(0).getConflictingSession().getId());
    }

    @Test
    void shouldReportInvalidTimeAndSkipThatSession() {
        Session invalid = session(1L, 1L, "R01", time(11, 0), time(10, 0));
        Session valid = session(2L, 1L, "R01", time(9, 0), time(12, 0));
        when(conflictDetectionRepository.findSessionsInDraft(VERSION_ID))
                .thenReturn(List.of(invalid, valid));

        ConflictCheckResult result = service.checkConflicts(VERSION_ID);

        assertFalse(result.isHasConflict());
        assertTrue(result.getConflicts().isEmpty());
        assertTrue(result.getValidationErrors().containsKey("sessions.1.time"));
    }

    @Test
    void shouldRejectInvalidVersionIdAndNonDraftVersion() {
        assertThrows(BadRequestException.class, () -> service.checkConflicts(null));
        assertThrows(BadRequestException.class, () -> service.checkConflicts(0L));

        CalendarVersion active = CalendarVersion.builder()
                .calendar(Calendar.builder()
                        .classId(TARGET_CLASS_ID)
                        .name("Java 01")
                        .isActive(true)
                        .build())
                .versionNumber(1)
                .status(CalendarVersionStatus.ACTIVE)
                .isActive(true)
                .build();
        when(calendarVersionRepository.findById(30L)).thenReturn(Optional.of(active));

        assertThrows(ConflictException.class, () -> service.checkConflicts(30L));
    }

    private void assertPairConflict(
            LocalDateTime firstStart,
            LocalDateTime firstEnd,
            LocalDateTime secondStart,
            LocalDateTime secondEnd,
            boolean expectedConflict
    ) {
        Session first = session(1L, 1L, "R01", firstStart, firstEnd);
        Session second = session(2L, 1L, "R02", secondStart, secondEnd);
        when(conflictDetectionRepository.findSessionsInDraft(VERSION_ID))
                .thenReturn(List.of(first, second));

        ConflictCheckResult result = service.checkConflicts(VERSION_ID);

        assertEquals(expectedConflict, result.isHasConflict());
    }

    private Session session(
            Long id,
            Long trainerId,
            String room,
            LocalDateTime start,
            LocalDateTime end
    ) {
        return Session.builder()
                .id(id)
                .trainerId(trainerId)
                .trainerName("Trainer " + trainerId)
                .classCode("TEST")
                .title("Session " + id)
                .startTime(start)
                .endTime(end)
                .room(room)
                .status(SessionStatus.SCHEDULED)
                .isActive(true)
                .build();
    }

    private static LocalDateTime time(int hour, int minute) {
        return LocalDateTime.of(TEST_DATE, LocalTime.of(hour, minute));
    }

    private static ConflictDTO conflictDto(
            Session session,
            Session conflictingSession,
            Set<ConflictType> conflictTypes
    ) {
        SessionDTO sessionDto = new SessionDTO();
        sessionDto.setId(session.getId());
        SessionDTO conflictingSessionDto = new SessionDTO();
        conflictingSessionDto.setId(conflictingSession.getId());
        return ConflictDTO.builder()
                .session(sessionDto)
                .conflictingSession(conflictingSessionDto)
                .conflictTypes(EnumSet.copyOf(conflictTypes))
                .build();
    }
}
