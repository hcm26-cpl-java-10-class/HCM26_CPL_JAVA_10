package com.example.starter_project_2025.service;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.detection.ConflictDetectionServiceImpl;
import com.example.starter_project_2025.system.schedule.detection.ConflictType;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionMapper;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ConflictDetectionServiceTest {

    @Mock
    private CalendarVersionRepository calendarVersionRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private SessionMapper sessionMapper;

    private ConflictDetectionServiceImpl conflictDetectionService;

    private Calendar mockCalendar;
    private CalendarVersion draftVersion;

    @BeforeEach
    void setUp() {
        conflictDetectionService = new ConflictDetectionServiceImpl(
                calendarVersionRepository,
                sessionRepository,
                sessionMapper
        );

        mockCalendar = Calendar.builder()
                .id(1L)
                .classId(101L)
                .name("Fullstack Java 2026")
                .isActive(true)
                .build();

        draftVersion = CalendarVersion.builder()
                .id(10L)
                .versionNumber(1)
                .status(CalendarVersionStatus.DRAFT)
                .calendar(mockCalendar)
                .isActive(true)
                .build();

        lenient().when(sessionMapper.toResponse(any(Session.class))).thenAnswer(invocation -> {
            Session s = invocation.getArgument(0);
            SessionDTO dto = SessionDTO.builder()
                    .title(s.getTitle())
                    .startTime(s.getStartTime())
                    .endTime(s.getEndTime())
                    .trainerId(s.getTrainerId())
                    .room(s.getRoom())
                    .build();
            dto.setId(s.getId());
            return dto;
        });
    }

    @Test
    @DisplayName("TC-CF-01: Throw ResourceNotFoundException when CalendarVersion does not exist")
    void checkConflicts_ThrowsNotFound_WhenVersionMissing() {
        when(calendarVersionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                conflictDetectionService.checkConflicts(999L));
    }

    @Test
    @DisplayName("TC-CF-02: Throw ConflictException when CalendarVersion is NOT in DRAFT status")
    void checkConflicts_ThrowsConflictException_WhenVersionNotDraft() {
        CalendarVersion activeVer = CalendarVersion.builder()
                .id(20L)
                .versionNumber(2)
                .status(CalendarVersionStatus.ACTIVE)
                .calendar(mockCalendar)
                .isActive(true)
                .build();

        when(calendarVersionRepository.findById(20L)).thenReturn(Optional.of(activeVer));

        assertThrows(ConflictException.class, () ->
                conflictDetectionService.checkConflicts(20L));
    }

    @Test
    @DisplayName("TC-CF-03: Return no conflicts when DRAFT version has no sessions")
    void checkConflicts_ReturnsNoConflict_WhenEmpty() {
        when(calendarVersionRepository.findById(10L)).thenReturn(Optional.of(draftVersion));
        when(sessionRepository.findByCalendarVersion_IdAndIsActiveTrue(10L)).thenReturn(List.of());
        when(sessionRepository.findActiveSessionsFromOtherCalendars(1L)).thenReturn(List.of());

        ConflictCheckResult result = conflictDetectionService.checkConflicts(10L);

        assertNotNull(result);
        assertFalse(result.isHasConflict());
        assertTrue(result.getConflicts().isEmpty());
    }

    @Test
    @DisplayName("TC-CF-04: Detect TRAINER_CONFLICT when 2 sessions in DRAFT have the same trainer at overlapping time")
    void checkConflicts_DetectsTrainerConflict_WithinDraft() {
        when(calendarVersionRepository.findById(10L)).thenReturn(Optional.of(draftVersion));

        Session s1 = Session.builder()
                .id(101L)
                .title("Java Core - Session 1")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 11, 30))
                .trainerId(1L)
                .room("Room A-301")
                .status(SessionStatus.SCHEDULED)
                .build();

        Session s2 = Session.builder()
                .id(102L)
                .title("Database - Session 1")
                .startTime(LocalDateTime.of(2026, 11, 2, 9, 0)) // Overlaps 9:00 - 11:30
                .endTime(LocalDateTime.of(2026, 11, 2, 12, 0))
                .trainerId(1L) // Same trainer!
                .room("Room B-202") // Different room
                .status(SessionStatus.SCHEDULED)
                .build();

        when(sessionRepository.findByCalendarVersion_IdAndIsActiveTrue(10L)).thenReturn(List.of(s1, s2));
        when(sessionRepository.findActiveSessionsFromOtherCalendars(1L)).thenReturn(List.of());

        ConflictCheckResult result = conflictDetectionService.checkConflicts(10L);

        assertTrue(result.isHasConflict());
        assertEquals(1, result.getConflicts().size());
        assertTrue(result.getConflicts().get(0).getConflictTypes().contains(ConflictType.TRAINER_CONFLICT));
        assertFalse(result.getConflicts().get(0).getConflictTypes().contains(ConflictType.ROOM_CONFLICT));
    }

    @Test
    @DisplayName("TC-CF-05: Detect ROOM_CONFLICT when 2 sessions in DRAFT have the same room at overlapping time")
    void checkConflicts_DetectsRoomConflict_WithinDraft() {
        when(calendarVersionRepository.findById(10L)).thenReturn(Optional.of(draftVersion));

        Session s1 = Session.builder()
                .id(101L)
                .title("Java Core - Session 1")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 11, 30))
                .trainerId(1L)
                .room("Room A-301")
                .status(SessionStatus.SCHEDULED)
                .build();

        Session s2 = Session.builder()
                .id(102L)
                .title("Database - Session 1")
                .startTime(LocalDateTime.of(2026, 11, 2, 9, 0)) // Overlaps
                .endTime(LocalDateTime.of(2026, 11, 2, 12, 0))
                .trainerId(2L) // Different trainer
                .room("Room A-301") // Same room!
                .status(SessionStatus.SCHEDULED)
                .build();

        when(sessionRepository.findByCalendarVersion_IdAndIsActiveTrue(10L)).thenReturn(List.of(s1, s2));
        when(sessionRepository.findActiveSessionsFromOtherCalendars(1L)).thenReturn(List.of());

        ConflictCheckResult result = conflictDetectionService.checkConflicts(10L);

        assertTrue(result.isHasConflict());
        assertEquals(1, result.getConflicts().size());
        assertTrue(result.getConflicts().get(0).getConflictTypes().contains(ConflictType.ROOM_CONFLICT));
        assertFalse(result.getConflicts().get(0).getConflictTypes().contains(ConflictType.TRAINER_CONFLICT));
    }

    @Test
    @DisplayName("TC-CF-06: Detect both TRAINER_CONFLICT and ROOM_CONFLICT when both clash")
    void checkConflicts_DetectsBothTrainerAndRoomConflict() {
        when(calendarVersionRepository.findById(10L)).thenReturn(Optional.of(draftVersion));

        Session s1 = Session.builder()
                .id(101L)
                .title("Java Core")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 11, 30))
                .trainerId(1L)
                .room("Room A-301")
                .status(SessionStatus.SCHEDULED)
                .build();

        Session s2 = Session.builder()
                .id(102L)
                .title("Spring Boot")
                .startTime(LocalDateTime.of(2026, 11, 2, 10, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 12, 0))
                .trainerId(1L)
                .room("Room A-301")
                .status(SessionStatus.SCHEDULED)
                .build();

        when(sessionRepository.findByCalendarVersion_IdAndIsActiveTrue(10L)).thenReturn(List.of(s1, s2));
        when(sessionRepository.findActiveSessionsFromOtherCalendars(1L)).thenReturn(List.of());

        ConflictCheckResult result = conflictDetectionService.checkConflicts(10L);

        assertTrue(result.isHasConflict());
        assertEquals(1, result.getConflicts().size());
        assertTrue(result.getConflicts().get(0).getConflictTypes().contains(ConflictType.TRAINER_CONFLICT));
        assertTrue(result.getConflicts().get(0).getConflictTypes().contains(ConflictType.ROOM_CONFLICT));
    }

    @Test
    @DisplayName("TC-CF-07: Touching endpoints (S1 ends 11:30, S2 starts 11:30) must NOT conflict (Valid)")
    void checkConflicts_TouchingEndpoints_DoNotConflict() {
        when(calendarVersionRepository.findById(10L)).thenReturn(Optional.of(draftVersion));

        Session s1 = Session.builder()
                .id(101L)
                .title("Morning Class")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 11, 30)) // Ends 11:30
                .trainerId(1L)
                .room("Room A-301")
                .status(SessionStatus.SCHEDULED)
                .build();

        Session s2 = Session.builder()
                .id(102L)
                .title("Afternoon Class")
                .startTime(LocalDateTime.of(2026, 11, 2, 11, 30)) // Starts exactly 11:30
                .endTime(LocalDateTime.of(2026, 11, 2, 15, 0))
                .trainerId(1L)
                .room("Room A-301")
                .status(SessionStatus.SCHEDULED)
                .build();

        when(sessionRepository.findByCalendarVersion_IdAndIsActiveTrue(10L)).thenReturn(List.of(s1, s2));
        when(sessionRepository.findActiveSessionsFromOtherCalendars(1L)).thenReturn(List.of());

        ConflictCheckResult result = conflictDetectionService.checkConflicts(10L);

        assertFalse(result.isHasConflict());
        assertTrue(result.getConflicts().isEmpty());
    }

    @Test
    @DisplayName("TC-CF-08: Cross-calendar conflict detection against ACTIVE versions of other classes")
    void checkConflicts_DetectsConflict_WithOtherClassActiveCalendar() {
        when(calendarVersionRepository.findById(10L)).thenReturn(Optional.of(draftVersion));

        // Draft session of current class
        Session draftSession = Session.builder()
                .id(101L)
                .title("Class A - Session 1")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 11, 30))
                .trainerId(5L)
                .room("Room A-301")
                .status(SessionStatus.SCHEDULED)
                .build();

        // Active session of Class B
        Session activeSessionOtherClass = Session.builder()
                .id(205L)
                .title("Class B - Session 1")
                .startTime(LocalDateTime.of(2026, 11, 2, 9, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 12, 0))
                .trainerId(5L) // Trainer 5 is teaching Class B!
                .room("Room B-202")
                .status(SessionStatus.SCHEDULED)
                .build();

        when(sessionRepository.findByCalendarVersion_IdAndIsActiveTrue(10L)).thenReturn(List.of(draftSession));
        when(sessionRepository.findActiveSessionsFromOtherCalendars(1L)).thenReturn(List.of(activeSessionOtherClass));

        ConflictCheckResult result = conflictDetectionService.checkConflicts(10L);

        assertTrue(result.isHasConflict());
        assertEquals(1, result.getConflicts().size());
        assertTrue(result.getConflicts().get(0).getConflictTypes().contains(ConflictType.TRAINER_CONFLICT));
    }
}
