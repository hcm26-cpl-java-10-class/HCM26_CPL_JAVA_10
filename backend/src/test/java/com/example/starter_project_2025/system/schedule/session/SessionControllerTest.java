package com.example.starter_project_2025.system.schedule.session;

import jakarta.validation.Validator;
import com.example.starter_project_2025.system.schedule.session.dto.CreateSessionRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class SessionControllerTest {

    @Mock private SessionRepository repository;
    @Mock private ObjectProvider<SessionReadContextProvider> providers;
    @Mock private SessionReadContextProvider contextProvider;
    @Mock private ObjectProvider<SessionCreateContextProvider> createContextProviders;
    @Mock private ObjectProvider<SessionCreateConflictChecker> createConflictCheckers;
    @Mock private SessionCreateContextProvider createContextProvider;
    @Mock private Validator validator;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        var service = new SessionServiceImpl(repository, Mappers.getMapper(SessionMapper.class),
                new SessionAccessPolicy(providers), createContextProviders, createConflictCheckers, validator);
        mvc = MockMvcBuilders.standaloneSetup(new SessionController(service))
                .setControllerAdvice(new SessionApiExceptionHandler()).build();
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @ParameterizedTest
    @ValueSource(strings = {"DRAFT", "ACTIVE", "ARCHIVED"})
    void readsAuthorizedSessionWithoutRestrictingVersionStatus(String versionStatus) throws Exception {
        Authentication actor = authenticate("SESSION_READ");
        Session session = session();
        when(repository.findByIdAndIsActiveTrue(101L)).thenReturn(Optional.of(session));
        when(providers.getIfAvailable()).thenReturn(contextProvider);
        when(contextProvider.findReadableContext(20L, 12L, 7L, actor)).thenReturn(Optional.of(
                new SessionReadContextProvider.ReadContext(2L, versionStatus, 1L,
                        "JAVA-10", "Spring MVC", "Trainer A")));

        mvc.perform(get("/api/v1/sessions/101"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(101))
                .andExpect(jsonPath("$.calendarVersionId").value(20))
                .andExpect(jsonPath("$.calendarVersionNumber").value(2))
                .andExpect(jsonPath("$.calendarVersionStatus").value(versionStatus))
                .andExpect(jsonPath("$.classId").value(1))
                .andExpect(jsonPath("$.classCode").value("JAVA-10"))
                .andExpect(jsonPath("$.title").value("MVC practice"))
                .andExpect(jsonPath("$.topicId").value(12))
                .andExpect(jsonPath("$.topicName").value("Spring MVC"))
                .andExpect(jsonPath("$.trainerId").value(7))
                .andExpect(jsonPath("$.trainerName").value("Trainer A"))
                .andExpect(jsonPath("$.startTime").value("2026-10-15T08:00:00"))
                .andExpect(jsonPath("$.endTime").value("2026-10-15T10:00:00"))
                .andExpect(jsonPath("$.room").value("A101"))
                .andExpect(jsonPath("$.meetingLink").value("https://example.com/lesson"))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.notes").value("Lesson finished"))
                .andExpect(jsonPath("$.version").value(4))
                .andExpect(jsonPath("$.createdAt").value("2026-10-14T09:00:00"))
                .andExpect(jsonPath("$.updatedAt").value("2026-10-15T10:05:00"))
                .andExpect(jsonPath("$.createdBy").value(3))
                .andExpect(jsonPath("$.updatedBy").value(4))
                .andExpect(jsonPath("$.revision").doesNotExist())
                .andExpect(jsonPath("$.isOverridden").doesNotExist())
                .andExpect(jsonPath("$.overrideReason").doesNotExist());

        verify(repository).findByIdAndIsActiveTrue(101L);
        verifyNoMoreInteractions(repository);
        verify(contextProvider).findReadableContext(20L, 12L, 7L, actor);
    }

    @Test
    void rejectsUnauthenticatedCaller() throws Exception {
        mvc.perform(get("/api/v1/sessions/101"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        verifyNoInteractions(repository, providers, contextProvider);
    }

    @Test
    void rejectsCallerWithoutReadPermission() throws Exception {
        authenticate("SESSION_UPDATE");
        mvc.perform(get("/api/v1/sessions/101"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        verifyNoInteractions(repository, providers, contextProvider);
    }

    @Test
    void rejectsSessionOutsideClassScopeWithoutReturningDetails() throws Exception {
        Authentication actor = authenticate("SESSION_READ");
        when(repository.findByIdAndIsActiveTrue(101L)).thenReturn(Optional.of(session()));
        when(providers.getIfAvailable()).thenReturn(contextProvider);
        when(contextProvider.findReadableContext(20L, 12L, 7L, actor)).thenReturn(Optional.empty());

        mvc.perform(get("/api/v1/sessions/101").header("X-Correlation-ID", "hung-read-1"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.fieldErrors").isMap())
                .andExpect(jsonPath("$.correlationId").value("hung-read-1"))
                .andExpect(header().string("X-Correlation-ID", "hung-read-1"));
    }

    @Test
    void returnsNotFoundForMissingOrDeletedSession() throws Exception {
        authenticate("SESSION_READ");
        when(repository.findByIdAndIsActiveTrue(101L)).thenReturn(Optional.empty());
        mvc.perform(get("/api/v1/sessions/101"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
        verifyNoInteractions(providers, contextProvider);
    }

    @Test
    void deniesAccessUntilScopeIntegrationIsAvailable() throws Exception {
        authenticate("SESSION_READ");
        when(repository.findByIdAndIsActiveTrue(101L)).thenReturn(Optional.of(session()));
        mvc.perform(get("/api/v1/sessions/101"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SESSION_CONTEXT_UNAVAILABLE"))
                .andExpect(jsonPath("$.title").doesNotExist());
    }

    @Test
    void doesNotSaveWithoutCreateContextImplementation() throws Exception {
        authenticate("SESSION_CREATE");
        when(validator.validate(any(CreateSessionRequest.class))).thenReturn(Set.of());
        mvc.perform(post("/api/v1/calendar-versions/20/sessions")
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SESSION_CONTEXT_UNAVAILABLE"));
        verifyNoInteractions(repository, createConflictCheckers);
    }

    @Test
    void doesNotSaveWithoutConflictCheckerImplementation() throws Exception {
        authenticate("SESSION_CREATE");
        when(validator.validate(any(CreateSessionRequest.class))).thenReturn(Set.of());
        when(createContextProviders.getIfAvailable()).thenReturn(createContextProvider);
        when(createContextProvider.lockCalendarVersion(eq(20L), any())).thenReturn(Optional.of(
                new SessionCreateContextProvider.CalendarVersionContext(2L, "DRAFT", 1L, "JAVA-10", 1L,
                        LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), Set.of(), true)));
        when(createContextProvider.findTopic(eq(12L), any())).thenReturn(Optional.of(
                new SessionCreateContextProvider.TopicContext(1L, "Spring MVC")));
        when(createContextProvider.findTrainer(eq(7L), eq(1L), eq(12L), any())).thenReturn(Optional.of(
                new SessionCreateContextProvider.TrainerContext("Trainer A", true)));
        mvc.perform(post("/api/v1/calendar-versions/20/sessions")
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SESSION_CONFLICT_CHECK_UNAVAILABLE"));
        verifyNoInteractions(repository);
    }

    private String createBody() {
        return """
                {"title":"MVC practice","topicId":12,"trainerId":7,
                 "startTime":"2026-10-19T08:00:00","endTime":"2026-10-19T10:00:00"}
                """;
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "abc", "9223372036854775808"})
    void rejectsInvalidId(String id) throws Exception {
        authenticate("SESSION_READ");
        mvc.perform(get("/api/v1/sessions/" + id))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(repository, providers, contextProvider);
    }

    private Authentication authenticate(String permission) {
        var actor = new TestingAuthenticationToken("hung", "unused", permission);
        SecurityContextHolder.getContext().setAuthentication(actor);
        return actor;
    }

    private Session session() {
        return Session.builder().id(101L).calendarVersionId(20L).topicId(12L).trainerId(7L)
                .title("MVC practice").startTime(LocalDateTime.of(2026, 10, 15, 8, 0))
                .endTime(LocalDateTime.of(2026, 10, 15, 10, 0)).room("A101")
                .meetingLink("https://example.com/lesson").status(SessionStatus.COMPLETED)
                .notes("Lesson finished").createdAt(LocalDateTime.of(2026, 10, 14, 9, 0))
                .updatedAt(LocalDateTime.of(2026, 10, 15, 10, 5)).createdBy(3L).updatedBy(4L)
                .version(4L).build();
    }
}
