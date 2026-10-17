package com.example.starter_project_2025.system.schedule.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:session_cancel_merge")
@AutoConfigureMockMvc
class SessionCancelIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private SessionRepository repository;
    @Autowired private ObjectMapper objectMapper;
    private final List<Long> createdIds = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        SecurityContextHolder.clearContext();
        repository.deleteAllById(createdIds);
    }

    @Test
    void cancelsSessionAndReturnsCommittedVersionInBodyAndEtag() throws Exception {
        Session session = persist(SessionStatus.SCHEDULED, true);
        long nextVersion = session.getVersion() + 1;

        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .session(authenticatedSession("SESSION_UPDATE"))
                        .header("If-Match", "\"" + session.getVersion() + "\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "cancelReason", "  Trainer unavailable  ",
                                "notes", "Arrange a replacement lesson",
                                "version", session.getVersion() + 10))))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"" + nextVersion + "\""))
                .andExpect(jsonPath("$.id").value(session.getId()))
                .andExpect(jsonPath("$.calendarVersionId").value(20))
                .andExpect(jsonPath("$.topicId").value(12))
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelReason").value("Trainer unavailable"))
                .andExpect(jsonPath("$.notes").value("Arrange a replacement lesson"))
                .andExpect(jsonPath("$.version").value(nextVersion))
                .andExpect(jsonPath("$.isOverridden").doesNotExist())
                .andExpect(jsonPath("$.revision").doesNotExist());

        Session stored = repository.findById(session.getId()).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(SessionStatus.CANCELLED);
        assertThat(stored.getCancelReason()).isEqualTo("Trainer unavailable");
        assertThat(stored.getNotes()).isEqualTo("Arrange a replacement lesson");
        assertThat(stored.getVersion()).isEqualTo(nextVersion);
    }

    @Test
    void acceptsBodyVersionAndPreservesNotesWhenNotProvided() throws Exception {
        Session session = persist(SessionStatus.SCHEDULED, true);
        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .session(authenticatedSession("SESSION_UPDATE"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "cancelReason", "Room unavailable", "version", session.getVersion()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").value("Original notes"))
                .andExpect(jsonPath("$.version").value(session.getVersion() + 1));
    }

    @Test
    void rejectsStaleHeaderWithoutChangingSession() throws Exception {
        Session session = persist(SessionStatus.SCHEDULED, true);
        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .session(authenticatedSession("SESSION_UPDATE"))
                        .header("If-Match", "\"" + (session.getVersion() + 10) + "\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cancelReason\":\"Room unavailable\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SESSION_VERSION_CONFLICT"));
        assertUnchanged(session);
    }

    @Test
    void rejectsStaleBodyVersionWithoutChangingSession() throws Exception {
        Session session = persist(SessionStatus.SCHEDULED, true);
        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .session(authenticatedSession("SESSION_UPDATE"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "cancelReason", "Room unavailable", "version", session.getVersion() + 10))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SESSION_VERSION_CONFLICT"));
        assertUnchanged(session);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void rejectsMissingOrBlankReason(String reason) throws Exception {
        Session session = persist(SessionStatus.SCHEDULED, true);
        String body = reason == null ? "{}" : objectMapper.writeValueAsString(Map.of("cancelReason", reason));
        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .session(authenticatedSession("SESSION_UPDATE"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.cancelReason").isArray());
        assertUnchanged(session);
    }

    @Test
    void rejectsReasonLongerThanLimit() throws Exception {
        Session session = persist(SessionStatus.SCHEDULED, true);
        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .session(authenticatedSession("SESSION_UPDATE"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("cancelReason", "x".repeat(501)))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        assertUnchanged(session);
    }

    @ParameterizedTest
    @EnumSource(value = SessionStatus.class, names = {"COMPLETED", "CANCELLED"})
    void rejectsInvalidStateTransition(SessionStatus initialStatus) throws Exception {
        Session session = persist(initialStatus, true);
        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .session(authenticatedSession("SESSION_UPDATE"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cancelReason\":\"Room unavailable\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SESSION_INVALID_TRANSITION"));
        assertUnchanged(session);
    }

    @Test
    void rejectsMissingAndSoftDeletedSessions() throws Exception {
        Session deleted = persist(SessionStatus.SCHEDULED, false);
        for (Long id : List.of(deleted.getId(), Long.MAX_VALUE)) {
            mvc.perform(post("/api/v1/sessions/{id}/cancel", id)
                            .session(authenticatedSession("SESSION_UPDATE"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"cancelReason\":\"Room unavailable\"}"))
                    .andExpect(status().isNotFound());
        }
        assertUnchanged(deleted);
    }

    @Test
    void requiresAuthenticationAndUpdatePermission() throws Exception {
        Session session = persist(SessionStatus.SCHEDULED, true);
        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cancelReason\":\"Room unavailable\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .session(authenticatedSession("SESSION_READ"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cancelReason\":\"Room unavailable\"}"))
                .andExpect(status().isForbidden());
        assertUnchanged(session);
    }

    @Test
    void rejectsInvalidIfMatchWithoutChangingSession() throws Exception {
        Session session = persist(SessionStatus.SCHEDULED, true);
        mvc.perform(post("/api/v1/sessions/{id}/cancel", session.getId())
                        .session(authenticatedSession("SESSION_UPDATE"))
                        .header("If-Match", "abc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cancelReason\":\"Room unavailable\"}"))
                .andExpect(status().isBadRequest());
        assertUnchanged(session);
    }

    @Test
    void readStillRequiresRealScopeIntegration() throws Exception {
        Session session = persist(SessionStatus.SCHEDULED, true);
        mvc.perform(get("/api/v1/sessions/{id}", session.getId())
                        .session(authenticatedSession("SESSION_READ")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SESSION_CONTEXT_UNAVAILABLE"));
        assertUnchanged(session);
    }

    @Test
    void optimisticLockingRejectsStaleDatabaseWrite() {
        Session session = persist(SessionStatus.SCHEDULED, true);
        Session first = repository.findById(session.getId()).orElseThrow();
        Session stale = repository.findById(session.getId()).orElseThrow();
        first.setNotes("First change");
        repository.saveAndFlush(first);
        stale.setNotes("Stale change");

        assertThatThrownBy(() -> repository.saveAndFlush(stale))
                .isInstanceOf(OptimisticLockingFailureException.class);
        assertThat(repository.findById(session.getId()).orElseThrow().getNotes()).isEqualTo("First change");
    }

    private MockHttpSession authenticatedSession(String permission) {
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new TestingAuthenticationToken("hung", "unused", permission));
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return session;
    }

    private Session persist(SessionStatus status, boolean active) {
        Session saved = repository.saveAndFlush(Session.builder().calendarVersionId(20L).topicId(12L)
                .trainerId(7L).title("MVC practice").status(status).isActive(active)
                .startTime(LocalDateTime.of(2026, 10, 19, 8, 0))
                .endTime(LocalDateTime.of(2026, 10, 19, 10, 0)).notes("Original notes").build());
        createdIds.add(saved.getId());
        return saved;
    }

    private void assertUnchanged(Session original) {
        Session stored = repository.findById(original.getId()).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(original.getStatus());
        assertThat(stored.getVersion()).isEqualTo(original.getVersion());
        assertThat(stored.getCancelReason()).isEqualTo(original.getCancelReason());
        assertThat(stored.getNotes()).isEqualTo(original.getNotes());
    }
}
