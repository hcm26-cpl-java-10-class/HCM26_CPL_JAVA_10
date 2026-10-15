package com.example.starter_project_2025.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.system.academic.subject.Subject;
import com.example.starter_project_2025.system.academic.subject.SubjectRepository;
import com.example.starter_project_2025.system.study_session.CancelSessionRequest;
import com.example.starter_project_2025.system.study_session.CompleteSessionRequest;
import com.example.starter_project_2025.system.study_session.SessionStatus;
import com.example.starter_project_2025.system.study_session.StudySession;
import com.example.starter_project_2025.system.study_session.StudySessionChangedEvent;
import com.example.starter_project_2025.system.study_session.StudySessionDTO;
import com.example.starter_project_2025.system.study_session.StudySessionMapper;
import com.example.starter_project_2025.system.study_session.StudySessionRepository;
import com.example.starter_project_2025.system.study_session.StudySessionServiceImpl;
import com.example.starter_project_2025.system.study_session.StudySessionType;
import com.example.starter_project_2025.system.study_session.StudySessionVersionLock;
import jakarta.validation.Validation;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudySessionCancellationServiceTest {

    @Mock
    private StudySessionMapper studySessionMapper;

    @Mock
    private StudySessionRepository studySessionRepository;

    @Mock
    private SubjectRepository subjectRepository;

    @Mock
    private StudySessionVersionLock studySessionVersionLock;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private StudySessionServiceImpl studySessionService;

    private StudySession scheduledSession;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "test-user",
                        "password",
                        List.of(new SimpleGrantedAuthority("STUDY_SESSION_UPDATE"))
                )
        );
        scheduledSession = StudySession.builder()
                .id(1L)
                .status(SessionStatus.SCHEDULED)
                .build();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void cancelScheduledSessionSavesTrimmedReasonAndPublishesEvent() {
        CancelSessionRequest request = new CancelSessionRequest();
        request.setReason("  Lecturer unavailable  ");
        StudySessionDTO response = StudySessionDTO.builder().build();
        when(studySessionRepository.findById(1L)).thenReturn(Optional.of(scheduledSession));
        when(studySessionRepository.save(scheduledSession)).thenReturn(scheduledSession);
        when(studySessionMapper.toResponse(scheduledSession)).thenReturn(response);

        StudySessionDTO result = studySessionService.cancel(1L, request);

        assertEquals(response, result);
        assertEquals(SessionStatus.CANCELLED, scheduledSession.getStatus());
        assertEquals("Lecturer unavailable", scheduledSession.getCancelReason());
        verify(studySessionRepository).save(scheduledSession);
        verify(eventPublisher).publishEvent(
                new StudySessionChangedEvent(1L, SessionStatus.CANCELLED)
        );
    }

    @Test
    void cancelWithoutReasonReturnsBadRequestAndDoesNotSave() {
        CancelSessionRequest request = new CancelSessionRequest();
        request.setReason("  ");
        when(studySessionRepository.findById(1L)).thenReturn(Optional.of(scheduledSession));
        when(studySessionVersionLock.isLocked(1L)).thenReturn(false);

        assertThrows(BadRequestException.class, () -> studySessionService.cancel(1L, request));

        assertEquals(SessionStatus.SCHEDULED, scheduledSession.getStatus());
        verify(studySessionRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void cancelCompletedSessionReturnsConflictAndDoesNotSave() {
        scheduledSession.setStatus(SessionStatus.COMPLETED);
        when(studySessionRepository.findById(1L)).thenReturn(Optional.of(scheduledSession));
        when(studySessionVersionLock.isLocked(1L)).thenReturn(false);

        assertThrows(ConflictException.class, () -> studySessionService.cancel(1L, validRequest()));

        assertEquals(SessionStatus.COMPLETED, scheduledSession.getStatus());
        verify(studySessionRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void cancelLockedSessionReturnsForbiddenAndDoesNotSave() {
        when(studySessionRepository.findById(1L)).thenReturn(Optional.of(scheduledSession));
        when(studySessionVersionLock.isLocked(1L)).thenReturn(true);

        assertThrows(AccessDeniedException.class, () -> studySessionService.cancel(1L, validRequest()));

        assertEquals(SessionStatus.SCHEDULED, scheduledSession.getStatus());
        verify(studySessionRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void cancelMissingSessionReturnsNotFoundWithoutSaving() {
        when(studySessionRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> studySessionService.cancel(1L, validRequest()));

        verify(studySessionVersionLock, never()).isLocked(any());
        verify(studySessionRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void repositoryFailureDoesNotPublishChangeEvent() {
        when(studySessionRepository.findById(1L)).thenReturn(Optional.of(scheduledSession));
        when(studySessionVersionLock.isLocked(1L)).thenReturn(false);
        when(studySessionRepository.save(scheduledSession))
                .thenThrow(new IllegalStateException("Persistence failed"));

        assertThrows(IllegalStateException.class,
                () -> studySessionService.cancel(1L, validRequest()));

        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void completeScheduledSessionStoresTrimmedNotesAndPublishesEvent() {
        CompleteSessionRequest request = new CompleteSessionRequest();
        request.setNotes("  Attendance recorded  ");
        StudySessionDTO response = StudySessionDTO.builder().build();
        when(studySessionRepository.findById(1L))
                .thenReturn(Optional.of(scheduledSession));
        when(studySessionVersionLock.isLocked(1L)).thenReturn(false);
        when(studySessionRepository.save(scheduledSession))
                .thenReturn(scheduledSession);
        when(studySessionMapper.toResponse(scheduledSession))
                .thenReturn(response);

        StudySessionDTO result = studySessionService.complete(1L, request);

        assertEquals(response, result);
        assertEquals(SessionStatus.COMPLETED, scheduledSession.getStatus());
        assertEquals("Attendance recorded", scheduledSession.getNotes());
        verify(studySessionRepository).save(scheduledSession);
        verify(eventPublisher).publishEvent(
                new StudySessionChangedEvent(1L, SessionStatus.COMPLETED)
        );
    }

    @Test
    void completeCancelledSessionReturnsConflictAndDoesNotSave() {
        scheduledSession.setStatus(SessionStatus.CANCELLED);
        when(studySessionRepository.findById(1L)).thenReturn(Optional.of(scheduledSession));
        when(studySessionVersionLock.isLocked(1L)).thenReturn(false);

        assertThrows(
                ConflictException.class,
                () -> studySessionService.complete(
                        1L,
                        new CompleteSessionRequest()
                )
        );

        verify(studySessionRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void updateLockedSessionIsRejected() {
        when(studySessionRepository.findById(1L)).thenReturn(Optional.of(scheduledSession));
        when(studySessionVersionLock.isLocked(1L)).thenReturn(true);

        assertThrows(
                AccessDeniedException.class,
                () -> studySessionService.update(
                        1L,
                        StudySessionDTO.builder().build()
                )
        );

        verify(studySessionRepository, never()).save(any());
    }

    @Test
    void createValidSessionAssignsExistingSubjectAndSaves() {
        authenticate("STUDY_SESSION_CREATE");
        StudySessionDTO request = createRequest(
                9L,
                LocalTime.of(9, 0),
                LocalTime.of(10, 0)
        );
        Subject subject = Subject.builder().id(9L).subjectName("Java").build();
        StudySession entity = StudySession.builder()
                .subjectId(9L)
                .title("Java")
                .sessionDate(LocalDate.of(2026, 10, 15))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0))
                .build();
        StudySessionDTO response = StudySessionDTO.builder().build();
        when(studySessionMapper.toEntity(request)).thenReturn(entity);
        when(subjectRepository.findById(9L)).thenReturn(Optional.of(subject));
        when(studySessionRepository.save(entity)).thenReturn(entity);
        when(studySessionMapper.toResponse(entity)).thenReturn(response);

        StudySessionDTO result = studySessionService.create(request);

        assertEquals(response, result);
        assertEquals(subject, entity.getSubject());
        verify(studySessionRepository).save(entity);
    }

    @Test
    void createRejectsEndTimeThatDoesNotFollowStartTime() {
        authenticate("STUDY_SESSION_CREATE");
        StudySessionDTO request = createRequest(
                9L,
                LocalTime.of(10, 0),
                LocalTime.of(9, 0)
        );
        StudySession entity = StudySession.builder()
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .build();
        when(studySessionMapper.toEntity(request)).thenReturn(entity);
        when(subjectRepository.findById(9L))
                .thenReturn(Optional.of(Subject.builder().id(9L).build()));

        assertThrows(
                BusinessValidationException.class,
                () -> studySessionService.create(request)
        );

        verify(studySessionRepository, never()).save(any());
    }

    @Test
    void createRejectsUnknownSubject() {
        authenticate("STUDY_SESSION_CREATE");
        StudySessionDTO request = createRequest(
                9L,
                LocalTime.of(9, 0),
                LocalTime.of(10, 0)
        );
        StudySession entity = StudySession.builder().build();
        when(studySessionMapper.toEntity(request)).thenReturn(entity);
        when(subjectRepository.findById(9L)).thenReturn(Optional.empty());

        assertThrows(
                BusinessValidationException.class,
                () -> studySessionService.create(request)
        );

        verify(studySessionRepository, never()).save(any());
    }

    @Test
    void createDTORequiresMandatoryFields() {
        try (var validatorFactory = Validation.buildDefaultValidatorFactory()) {
            var violations = validatorFactory.getValidator()
                    .validate(new StudySessionDTO(), OnCreate.class);

            assertTrue(violations.stream()
                    .anyMatch(violation -> violation.getPropertyPath().toString().equals("title")));
            assertTrue(violations.stream()
                    .anyMatch(violation -> violation.getPropertyPath().toString().equals("subjectId")));
            assertTrue(violations.stream()
                    .anyMatch(violation -> violation.getPropertyPath().toString().equals("endTime")));
        }
    }

    private CancelSessionRequest validRequest() {
        CancelSessionRequest request = new CancelSessionRequest();
        request.setReason("Schedule changed");
        return request;
    }

    private StudySessionDTO createRequest(
            Long subjectId,
            LocalTime startTime,
            LocalTime endTime
    ) {
        return StudySessionDTO.builder()
                .subjectId(subjectId)
                .title("Java")
                .sessionDate(LocalDate.of(2026, 10, 15))
                .startTime(startTime)
                .endTime(endTime)
                .type(StudySessionType.LECTURE)
                .build();
    }

    private void authenticate(String permission) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "test-user",
                        "password",
                        List.of(new SimpleGrantedAuthority(permission))
                )
        );
    }
}
