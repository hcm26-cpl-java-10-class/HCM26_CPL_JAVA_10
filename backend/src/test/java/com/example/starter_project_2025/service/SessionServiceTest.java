package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.crud.CalendarLock;
import com.example.starter_project_2025.system.schedule.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.exception.UnprocessableEntityException;
import com.example.starter_project_2025.system.schedule.session.*;
import com.example.starter_project_2025.system.schedule.session.dto.ConflictCheckResponse;
import com.example.starter_project_2025.system.schedule.session.dto.SessionCancelRequest;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.system.schedule.session_audit.SessionStatusHistoryRecorder;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.junit.jupiter.api.AfterEach;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SessionServiceTest {

    @Mock
    private SessionMapper sessionMapper;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private SessionValidator sessionValidator;

    @Mock
    private SessionAccessPolicy sessionAccessPolicy;

    @Mock
    private CalendarLock calendarLock;

    @Mock
    private EntityManager entityManager;

    @Mock
    private SessionStatusHistoryRecorder statusHistoryRecorder;

    private SessionServiceImpl sessionService;

    @BeforeEach
    void setUp() {
        sessionService = new SessionServiceImpl(
                sessionMapper,
                sessionRepository,
                sessionValidator,
                sessionAccessPolicy,
                calendarLock,
                entityManager,
                statusHistoryRecorder
        );

        CalendarVersion cv = CalendarVersion.builder()
                .id(1L)
                .status(CalendarVersionStatus.DRAFT)
                .isActive(true)
                .build();
        lenient().when(calendarLock.session(anyLong())).thenReturn(cv);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin",
                        "password",
                        List.of(
                                new SimpleGrantedAuthority("ROLE_ADMIN"),
                                new SimpleGrantedAuthority("SESSION_UPDATE"),
                                new SimpleGrantedAuthority("SESSION_READ")
                        )
                )
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("TC-SS-01: checkConflict returns true when overlapping session found for same trainer")
    void checkConflict_ReturnsConflict_WhenTrainerConflictExists() {
        SessionDTO request = SessionDTO.builder()
                .trainerId(1L)
                .trainerName("Nguyen Minh")
                .room("Room A-301")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 11, 30))
                .build();

        Session existingConflict = Session.builder()
                .id(101L)
                .trainerId(1L)
                .trainerName("Nguyen Minh")
                .classCode("CLASS-A")
                .title("Java Core")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 30))
                .endTime(LocalDateTime.of(2026, 11, 2, 12, 0))
                .build();

        when(sessionRepository.findConflictingSessions(
                eq(1L), eq("Room A-301"), isNull(), any(), any(), isNull()
        )).thenReturn(List.of(existingConflict));

        ConflictCheckResponse response = sessionService.checkConflict(request, null);

        assertTrue(response.isHasConflict());
        assertNotNull(response.getMessage());
        assertTrue(response.getMessage().contains("Giảng viên"));
    }

    @Test
    @DisplayName("TC-SS-02: checkConflict returns true when overlapping session found for same room")
    void checkConflict_ReturnsConflict_WhenRoomConflictExists() {
        SessionDTO request = SessionDTO.builder()
                .trainerId(2L)
                .trainerName("Tran Lan")
                .room("Room A-301")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 11, 30))
                .build();

        Session existingConflict = Session.builder()
                .id(101L)
                .trainerId(1L) // different trainer
                .room("Room A-301") // same room
                .classCode("CLASS-B")
                .title("Database")
                .startTime(LocalDateTime.of(2026, 11, 2, 9, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 12, 0))
                .build();

        when(sessionRepository.findConflictingSessions(
                eq(2L), eq("Room A-301"), isNull(), any(), any(), isNull()
        )).thenReturn(List.of(existingConflict));

        ConflictCheckResponse response = sessionService.checkConflict(request, null);

        assertTrue(response.isHasConflict());
        assertTrue(response.getMessage().contains("Phòng học"));
    }

    @Test
    @DisplayName("TC-SS-03: checkConflict returns false when no overlapping sessions exist")
    void checkConflict_ReturnsFalse_WhenNoConflicts() {
        SessionDTO request = SessionDTO.builder()
                .trainerId(1L)
                .room("Room A-301")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 11, 30))
                .build();

        when(sessionRepository.findConflictingSessions(
                eq(1L), eq("Room A-301"), isNull(), any(), any(), isNull()
        )).thenReturn(List.of());

        ConflictCheckResponse response = sessionService.checkConflict(request, null);

        assertFalse(response.isHasConflict());
    }

    @Test
    @DisplayName("TC-SS-04: cancel session succeeds when status is SCHEDULED and reason is provided")
    void cancel_Succeeds_WhenScheduledAndReasonProvided() {
        CalendarVersion cv = CalendarVersion.builder()
                .id(1L)
                .status(CalendarVersionStatus.DRAFT)
                .isActive(true)
                .build();

        Session session = Session.builder()
                .id(10L)
                .calendarVersion(cv)
                .status(SessionStatus.SCHEDULED)
                .build();
        session.setVersion(1L);

        when(sessionRepository.findById(10L)).thenReturn(Optional.of(session));
        when(sessionRepository.saveAndFlush(any(Session.class))).thenAnswer(i -> i.getArgument(0));

        SessionCancelRequest request = new SessionCancelRequest();
        request.setCancelReason("Trainer emergency leave");

        SessionDTO expectedDto = SessionDTO.builder().status(SessionStatus.CANCELLED).build();
        expectedDto.setId(10L);
        lenient().when(sessionMapper.toResponse(any())).thenReturn(expectedDto);

        SessionDTO result = sessionService.cancel(10L, request, 1L);

        assertNotNull(result);
        assertEquals(SessionStatus.CANCELLED, result.getStatus());
        assertEquals("Trainer emergency leave", session.getCancelReason());
    }

    @Test
    @DisplayName("TC-SS-05: cancel session throws UnprocessableEntityException when cancelReason is missing")
    void cancel_ThrowsException_WhenReasonMissing() {
        CalendarVersion cv = CalendarVersion.builder()
                .id(1L)
                .status(CalendarVersionStatus.DRAFT)
                .isActive(true)
                .build();

        Session session = Session.builder()
                .id(10L)
                .calendarVersion(cv)
                .status(SessionStatus.SCHEDULED)
                .build();

        when(sessionRepository.findById(10L)).thenReturn(Optional.of(session));

        SessionCancelRequest request = new SessionCancelRequest();
        request.setCancelReason(""); // empty reason

        assertThrows(UnprocessableEntityException.class, () ->
                sessionService.cancel(10L, request, null));
    }

    @Test
    @DisplayName("TC-SS-06: cancel session throws ConflictException when expectedVersion differs (Optimistic Locking)")
    void cancel_ThrowsConflict_WhenVersionMismatch() {
        CalendarVersion cv = CalendarVersion.builder()
                .id(1L)
                .status(CalendarVersionStatus.DRAFT)
                .isActive(true)
                .build();

        Session session = Session.builder()
                .id(10L)
                .calendarVersion(cv)
                .status(SessionStatus.SCHEDULED)
                .build();
        session.setVersion(2L); // Database has version 2

        when(sessionRepository.findById(10L)).thenReturn(Optional.of(session));

        SessionCancelRequest request = new SessionCancelRequest();
        request.setCancelReason("Trainer reschedule");

        // Client sent expectedVersion = 1L (stale ETag)
        assertThrows(ConflictException.class, () ->
                sessionService.cancel(10L, request, 1L));
    }
}
