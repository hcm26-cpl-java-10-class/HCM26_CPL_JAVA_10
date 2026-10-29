package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.GlobalExceptionHandler;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.ScheduleValidationEngine;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentSessionGuard;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authorization.method.AuthorizationManagerBeforeMethodInterceptor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real controller, exception advice, permission checks, service and mapper; no database or app data. */
class SessionCompletionTest {
    private static final long ID = 41L;

    private SessionRepository repository;
    private ScheduleValidationEngine scheduling;
    private TeachingAssignmentSessionGuard assignmentGuard;
    private SessionServiceImpl service;
    private Session session;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        repository = mock(SessionRepository.class);
        scheduling = mock(ScheduleValidationEngine.class);
        assignmentGuard = mock(TeachingAssignmentSessionGuard.class);
        service = new SessionServiceImpl(new SessionMapperImpl(), repository, scheduling, assignmentGuard);
        session = Session.builder()
                .id(ID).classId(12L).topicId(23L).trainerId(34L).teachingAssignmentId(56L)
                .roomId(67L).location("Existing room").meetingUrl("https://meet.example/existing")
                .title("Existing session")
                .startTime(LocalDateTime.of(2026, 10, 29, 8, 0))
                .endTime(LocalDateTime.of(2026, 10, 29, 10, 0))
                .status(Session.SessionStatus.SCHEDULED).note("Existing note")
                .isActive(true).createdBy(78L).updatedBy(78L)
                .createdAt(LocalDateTime.of(2026, 10, 1, 9, 0))
                .updatedAt(LocalDateTime.of(2026, 10, 2, 9, 0))
                .build();
        when(repository.findById(ID)).thenAnswer(invocation -> Optional.of(session));
        when(repository.save(any(Session.class))).thenAnswer(invocation -> invocation.getArgument(0));
        authenticate("SESSION_READ", "SESSION_UPDATE");

        var controller = new SessionController(service, repository, mock(SessionImportService.class));
        var factory = new ProxyFactory(controller);
        factory.setProxyTargetClass(true);
        factory.addAdvisor(AuthorizationManagerBeforeMethodInterceptor.preAuthorize());
        mvc = MockMvcBuilders.standaloneSetup(factory.getProxy())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(longs = 56L)
    void completesScheduledSessionAndPreservesEverySavedLink(Long assignmentId) {
        session.setTeachingAssignmentId(assignmentId);
        var original = new SessionMapperImpl().toDto(session);

        var result = service.completeSession(ID, completion("Discussed Java streams"));

        assertThat(result.getStatus()).isEqualTo(Session.SessionStatus.COMPLETED);
        assertThat(result.getNote()).isEqualTo("Discussed Java streams");
        assertThat(result).usingRecursiveComparison()
                .ignoringFields("status", "note").isEqualTo(original);
        assertThat(session.getTeachingAssignmentId()).isEqualTo(assignmentId);
        var order = inOrder(scheduling, repository);
        order.verify(scheduling).lockForWrite();
        order.verify(repository).findById(ID);
        order.verify(repository).save(session);
        verifyNoMoreInteractions(scheduling);
        verifyNoInteractions(assignmentGuard);
    }

    @ParameterizedTest
    @EnumSource(value = Session.SessionStatus.class, names = {"CANCELLED", "COMPLETED"})
    void refusesTerminalStatusesWithoutChangingNoteOrSaving(Session.SessionStatus existingStatus) {
        session.setStatus(existingStatus);

        assertThrows(ConflictException.class,
                () -> service.completeSession(ID, completion("Replacement note")));

        assertThat(session.getStatus()).isEqualTo(existingStatus);
        assertThat(session.getNote()).isEqualTo("Existing note");
        verify(repository, never()).save(any());
        verifyNoInteractions(assignmentGuard);
    }

    @Test
    void missingSessionIsNotFoundAndNeverSaved() {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.completeSession(ID, completion("Note")));

        verify(repository, never()).save(any());
        verifyNoInteractions(assignmentGuard);
    }

    @Test
    void updatePermissionAloneIsEnoughToComplete() {
        authenticate("SESSION_UPDATE");

        assertThat(service.completeSession(ID, null).getStatus()).isEqualTo(Session.SessionStatus.COMPLETED);
        assertThat(session.getNote()).isEqualTo("Existing note");
    }

    @Test
    void missingUpdatePermissionIsRejectedBeforeAnyDataAccess() {
        authenticate("SESSION_READ");

        assertThrows(AccessDeniedException.class, () -> service.completeSession(ID, completion("Note")));

        verifyNoInteractions(repository, scheduling, assignmentGuard);
        assertThat(session.getStatus()).isEqualTo(Session.SessionStatus.SCHEDULED);
        assertThat(session.getNote()).isEqualTo("Existing note");
    }

    @Test
    void nullNotePreservesExistingNote() {
        assertThat(service.completeSession(ID, completion(null)).getNote()).isEqualTo("Existing note");
    }

    @Test
    void explicitEmptyNoteClearsExistingNote() {
        assertThat(service.completeSession(ID, completion("")).getNote()).isEmpty();
    }

    @Test
    void completeResponseAndSubsequentDetailReadExposeSavedNote() throws Exception {
        mvc.perform(patch("/api/sessions/{id}/complete", ID)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Completed exercises\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ID))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.note").value("Completed exercises"));

        // A separate GET goes through the read path and maps the saved entity again.
        mvc.perform(get("/api/sessions/{id}", ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.note").value("Completed exercises"));
        verify(repository).save(session);
        verify(repository, times(2)).findById(ID);
    }

    @Test
    void completeEndpointAllowsAbsentBodyAndOnlyUpdatePermission() throws Exception {
        authenticate("SESSION_UPDATE");

        mvc.perform(patch("/api/sessions/{id}/complete", ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.note").value("Existing note"));
    }

    @ParameterizedTest
    @EnumSource(value = Session.SessionStatus.class, names = {"CANCELLED", "COMPLETED"})
    void completeEndpointReturns409ForTerminalStatuses(Session.SessionStatus existingStatus) throws Exception {
        session.setStatus(existingStatus);

        mvc.perform(patch("/api/sessions/{id}/complete", ID)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"New note\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Only scheduled sessions can be completed."));

        verify(repository, never()).save(any());
        assertThat(session.getNote()).isEqualTo("Existing note");
    }

    @Test
    void completeEndpointReturns404ForMissingSession() throws Exception {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        mvc.perform(patch("/api/sessions/{id}/complete", ID))
                .andExpect(status().isNotFound());

        verify(repository, never()).save(any());
    }

    @Test
    void completeEndpointReturns403WithoutUpdatePermission() throws Exception {
        authenticate("SESSION_READ");

        mvc.perform(patch("/api/sessions/{id}/complete", ID)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"New note\"}"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(repository, scheduling, assignmentGuard);
    }

    @Test
    void repeatedCompleteRequestReturns409AndDoesNotOverwriteTheFirstNote() throws Exception {
        mvc.perform(patch("/api/sessions/{id}/complete", ID)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"First note\"}"))
                .andExpect(status().isOk());

        mvc.perform(patch("/api/sessions/{id}/complete", ID)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Second note\"}"))
                .andExpect(status().isConflict());

        verify(repository).save(session);
        assertThat(session.getNote()).isEqualTo("First note");
    }

    private static SessionCompleteDTO completion(String note) {
        var request = new SessionCompleteDTO();
        request.setNote(note);
        return request;
    }

    private static void authenticate(String... permissions) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "session-tester", "", Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }
}
