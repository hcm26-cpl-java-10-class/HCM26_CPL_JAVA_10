package com.example.starter_project_2025.system.schedule.session;

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
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class SessionControllerTest {

    @Mock private SessionRepository repository;
    @Mock private ObjectProvider<SessionReadContextProvider> providers;
    @Mock private SessionReadContextProvider contextProvider;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        var service = new SessionServiceImpl(repository, Mappers.getMapper(SessionMapper.class),
                new SessionAccessPolicy(providers));
        mvc = MockMvcBuilders.standaloneSetup(new SessionController(service))
                .setControllerAdvice(new SessionExceptionHandler()).build();
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
                .updatedAt(LocalDateTime.of(2026, 10, 15, 10, 5)).createdBy(3L).updatedBy(4L).build();
    }
}
