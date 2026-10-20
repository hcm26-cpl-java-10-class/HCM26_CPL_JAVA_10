package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionMapper;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import com.example.starter_project_2025.system.schedule.calendar.exception.CalendarActivationConflictException;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.detection.ConflictDetectionService;
import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionService;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictDTO;
import com.example.starter_project_2025.system.schedule.exception.UnprocessableEntityException;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CalendarVersionActivationServiceTest {

    private static final Long CALENDAR_ID = 10L;
    private static final Long DRAFT_ID = 20L;
    private static final Long ACTOR_ID = 99L;
    private static final Instant NOW = Instant.parse("2026-10-20T07:30:00Z");

    private CalendarRepository calendarRepository;
    private CalendarVersionRepository calendarVersionRepository;
    private SessionRepository sessionRepository;
    private CalendarVersionMapper calendarVersionMapper;
    private ConflictDetectionService conflictDetectionService;
    private ConflictResolutionService conflictResolutionService;
    private CalendarVersionServiceImpl service;
    private Calendar calendar;
    private CalendarVersion draft;

    @BeforeEach
    void setUp() {
        calendarRepository = mock(CalendarRepository.class);
        calendarVersionRepository = mock(CalendarVersionRepository.class);
        sessionRepository = mock(SessionRepository.class);
        calendarVersionMapper = mock(CalendarVersionMapper.class);
        conflictDetectionService = mock(ConflictDetectionService.class);
        conflictResolutionService = mock(ConflictResolutionService.class);

        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new CalendarVersionServiceImpl(
                calendarRepository,
                calendarVersionRepository,
                sessionRepository,
                calendarVersionMapper,
                conflictDetectionService,
                conflictResolutionService,
                clock
        );

        calendar = Calendar.builder()
                .id(CALENDAR_ID)
                .classId(1001L)
                .name("Java 01")
                .isActive(true)
                .build();
        draft = CalendarVersion.builder()
                .id(DRAFT_ID)
                .calendar(calendar)
                .versionNumber(2)
                .status(CalendarVersionStatus.DRAFT)
                .isActive(true)
                .build();

        when(calendarRepository.lockAllActiveCalendarsForScheduleActivation())
                .thenReturn(List.of(calendar));
        when(calendarRepository.findActiveByIdForUpdate(CALENDAR_ID))
                .thenReturn(Optional.of(calendar));
        when(calendarVersionRepository.findActiveByIdForUpdate(CALENDAR_ID, DRAFT_ID))
                .thenReturn(Optional.of(draft));
        when(sessionRepository.existsByCalendarVersion_IdAndIsActiveTrueAndStatusNot(
                DRAFT_ID,
                SessionStatus.CANCELLED
        )).thenReturn(true);
        when(conflictDetectionService.checkConflicts(DRAFT_ID))
                .thenReturn(noConflicts());
        when(conflictResolutionService.resolve(any(ConflictCheckResult.class)))
                .thenAnswer(invocation -> {
                    ConflictCheckResult result = invocation.getArgument(0);
                    result.setHasBlockingConflict(result.isHasConflict());
                    return result;
                });
        when(calendarVersionRepository.saveAndFlush(draft)).thenReturn(draft);
        when(calendarVersionMapper.toResponse(draft)).thenAnswer(invocation -> {
            CalendarVersion entity = invocation.getArgument(0);
            return CalendarVersionResponse.builder()
                    .calendarId(entity.getCalendar().getId())
                    .versionNumber(entity.getVersionNumber())
                    .status(entity.getStatus())
                    .activatedAt(entity.getActivatedAt())
                    .activatedBy(entity.getActivatedBy())
                    .build();
        });
    }

    @Test
    void shouldActivateDraftAndDeactivateCurrentActiveVersion() {
        CalendarVersion currentActive = CalendarVersion.builder()
                .id(19L)
                .calendar(calendar)
                .versionNumber(1)
                .status(CalendarVersionStatus.ACTIVE)
                .isActive(true)
                .build();
        when(calendarVersionRepository.findActiveVersionByCalendarIdForUpdate(CALENDAR_ID))
                .thenReturn(Optional.of(currentActive));

        CalendarVersionResponse response = service.activateVersion(
                CALENDAR_ID,
                DRAFT_ID,
                ACTOR_ID
        );

        assertEquals(CalendarVersionStatus.INACTIVE, currentActive.getStatus());
        assertEquals(CalendarVersionStatus.ACTIVE, draft.getStatus());
        assertEquals(LocalDateTime.ofInstant(NOW, ZoneOffset.UTC), draft.getActivatedAt());
        assertEquals(ACTOR_ID, draft.getActivatedBy());
        assertEquals(CalendarVersionStatus.ACTIVE, response.getStatus());
        verify(conflictResolutionService).markApplied(any(ConflictCheckResult.class), eq(ACTOR_ID));
        verify(calendarRepository).lockAllActiveCalendarsForScheduleActivation();
        verify(conflictDetectionService).checkConflicts(DRAFT_ID);
        verify(calendarVersionRepository).save(currentActive);
        verify(calendarVersionRepository).saveAndFlush(draft);
    }

    @Test
    void shouldActivateFirstVersionWhenThereIsNoCurrentActiveVersion() {
        when(calendarVersionRepository.findActiveVersionByCalendarIdForUpdate(CALENDAR_ID))
                .thenReturn(Optional.empty());

        service.activateVersion(CALENDAR_ID, DRAFT_ID, ACTOR_ID);

        assertEquals(CalendarVersionStatus.ACTIVE, draft.getStatus());
        verify(calendarVersionRepository).saveAndFlush(draft);
    }

    @Test
    void shouldBlockActivationAndPreserveStatusesWhenConflictExists() {
        ConflictCheckResult result = ConflictCheckResult.builder()
                .calendarVersionId(DRAFT_ID)
                .hasConflict(true)
                .conflicts(List.of(new ConflictDTO()))
                .build();
        when(conflictDetectionService.checkConflicts(DRAFT_ID)).thenReturn(result);

        CalendarActivationConflictException exception = assertThrows(
                CalendarActivationConflictException.class,
                () -> service.activateVersion(CALENDAR_ID, DRAFT_ID, ACTOR_ID)
        );

        assertEquals(result, exception.getConflictCheckResult());
        assertEquals(CalendarVersionStatus.DRAFT, draft.getStatus());
        verify(calendarVersionRepository, never()).findActiveVersionByCalendarIdForUpdate(any());
        verify(calendarVersionRepository, never()).saveAndFlush(any());
    }

    @Test
    void shouldReturnValidationErrorBeforeEvaluatingConflicts() {
        Map<String, List<String>> validationErrors = new LinkedHashMap<>();
        validationErrors.put("sessions.1.time", List.of("Invalid time range"));
        when(conflictDetectionService.checkConflicts(DRAFT_ID))
                .thenReturn(ConflictCheckResult.builder()
                        .calendarVersionId(DRAFT_ID)
                        .hasConflict(true)
                        .conflicts(List.of(new ConflictDTO()))
                        .validationErrors(validationErrors)
                        .build());

        UnprocessableEntityException exception = assertThrows(
                UnprocessableEntityException.class,
                () -> service.activateVersion(CALENDAR_ID, DRAFT_ID, ACTOR_ID)
        );

        assertEquals("CALENDAR_ACTIVATION_VALIDATION_FAILED", exception.getCode());
        assertEquals(validationErrors, exception.getFieldErrors());
        assertEquals(CalendarVersionStatus.DRAFT, draft.getStatus());
        verify(calendarVersionRepository, never()).saveAndFlush(any());
    }

    @Test
    void shouldRejectEmptyDraftWithoutRunningConflictDetection() {
        when(sessionRepository.existsByCalendarVersion_IdAndIsActiveTrueAndStatusNot(
                DRAFT_ID,
                SessionStatus.CANCELLED
        )).thenReturn(false);

        UnprocessableEntityException exception = assertThrows(
                UnprocessableEntityException.class,
                () -> service.activateVersion(CALENDAR_ID, DRAFT_ID, ACTOR_ID)
        );

        assertEquals("CALENDAR_VERSION_EMPTY", exception.getCode());
        verifyNoInteractions(conflictDetectionService);
        verify(calendarVersionRepository, never()).saveAndFlush(any());
    }

    @Test
    void shouldRejectNonDraftVersion() {
        draft.setStatus(CalendarVersionStatus.ACTIVE);

        assertThrows(
                ConflictException.class,
                () -> service.activateVersion(CALENDAR_ID, DRAFT_ID, ACTOR_ID)
        );

        assertEquals(CalendarVersionStatus.ACTIVE, draft.getStatus());
        verifyNoInteractions(conflictDetectionService);
    }

    @Test
    void shouldRejectInvalidActivationIdentifiers() {
        assertThrows(BadRequestException.class,
                () -> service.activateVersion(null, DRAFT_ID, ACTOR_ID));
        assertThrows(BadRequestException.class,
                () -> service.activateVersion(CALENDAR_ID, 0L, ACTOR_ID));
        assertThrows(BadRequestException.class,
                () -> service.activateVersion(CALENDAR_ID, DRAFT_ID, null));

        verifyNoInteractions(conflictDetectionService);
    }

    private ConflictCheckResult noConflicts() {
        return ConflictCheckResult.builder()
                .calendarVersionId(DRAFT_ID)
                .hasConflict(false)
                .build();
    }
}
