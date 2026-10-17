package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictDTO;
import com.example.starter_project_2025.system.schedule.session.dto.CreateSessionRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:session_create_test")
@AutoConfigureMockMvc
class SessionCreateIntegrationTest {

    private static final String ENDPOINT = "/api/v1/calendar-versions/20/sessions";
    @Autowired private MockMvc mvc;
    @Autowired private SessionRepository repository;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private SessionService service;
    @MockBean private SessionCreateContextProvider provider;
    @MockBean private SessionCreateConflictChecker checker;

    @BeforeEach
    void setUp() {
        when(provider.lockCalendarVersion(eq(20L), any())).thenReturn(Optional.of(version("DRAFT", true, Set.of())));
        when(provider.findTopic(eq(12L), any())).thenReturn(Optional.of(
                new SessionCreateContextProvider.TopicContext(1L, "Spring MVC")));
        when(provider.findTrainer(eq(7L), eq(1L), eq(12L), any())).thenReturn(Optional.of(
                new SessionCreateContextProvider.TrainerContext("Trainer A", true)));
        when(checker.checkCandidate(eq(20L), any())).thenReturn(
                ConflictCheckResult.builder().calendarVersionId(20L).build());
    }

    @AfterEach
    void cleanUp() {
        SecurityContextHolder.clearContext();
        repository.deleteAll();
    }

    @Test
    void createsScheduledSessionWithServerOwnedFieldsAndAudit() throws Exception {
        when(provider.lockCalendarVersion(eq(20L), any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            assertThat(TransactionSynchronizationManager.isCurrentTransactionReadOnly()).isFalse();
            return Optional.of(version("DRAFT", true, Set.of()));
        });
        ObjectNode body = validRequest().put("id", 999).put("calendarVersionId", 777)
                .put("status", "COMPLETED").put("notes", "Client notes")
                .put("createdBy", 999).put("version", 500).put("cancelReason", "Client reason");
        var result = create(body)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.calendarVersionId").value(20))
                .andExpect(jsonPath("$.calendarVersionNumber").value(2))
                .andExpect(jsonPath("$.calendarVersionStatus").value("DRAFT"))
                .andExpect(jsonPath("$.classId").value(1))
                .andExpect(jsonPath("$.classCode").value("JAVA-10"))
                .andExpect(jsonPath("$.title").value("MVC practice"))
                .andExpect(jsonPath("$.topicId").value(12))
                .andExpect(jsonPath("$.topicName").value("Spring MVC"))
                .andExpect(jsonPath("$.trainerId").value(7))
                .andExpect(jsonPath("$.trainerName").value("Trainer A"))
                .andExpect(jsonPath("$.startTime").value("2026-10-19T08:00:00"))
                .andExpect(jsonPath("$.endTime").value("2026-10-19T10:00:00"))
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.notes").doesNotExist())
                .andExpect(jsonPath("$.cancelReason").doesNotExist())
                .andExpect(jsonPath("$.createdBy").value(7001))
                .andExpect(jsonPath("$.updatedBy").value(7001))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty())
                .andReturn();
        long id = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        assertThat(result.getResponse().getHeader("Location")).isEqualTo("/api/v1/sessions/" + id);
        Session stored = repository.findById(id).orElseThrow();
        assertThat(repository.count()).isEqualTo(1);
        assertThat(stored.getCalendarVersionId()).isEqualTo(20L);
        assertThat(stored.getIsActive()).isTrue();
        assertThat(stored.getStatus()).isEqualTo(SessionStatus.SCHEDULED);
        assertThat(stored.getNotes()).isNull();
        assertThat(stored.getVersion()).isZero();
        verify(checker).checkCandidate(eq(20L), any());
    }

    @Test
    void allowsOptionalRoomAndMeetingLink() throws Exception {
        create(validRequest().putNull("room").putNull("meetingLink"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.room").doesNotExist())
                .andExpect(jsonPath("$.meetingLink").doesNotExist());
    }

    @ParameterizedTest
    @ValueSource(strings = {"ACTIVE", "ARCHIVED", "INACTIVE"})
    void rejectsNonDraftVersion(String status) throws Exception {
        when(provider.lockCalendarVersion(eq(20L), any())).thenReturn(Optional.of(version(status, true, Set.of())));
        create(validRequest()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CALENDAR_VERSION_NOT_EDITABLE"));
        assertNotSaved();
        verifyNoInteractions(checker);
    }

    @Test
    void rejectsMissingVersion() throws Exception {
        when(provider.lockCalendarVersion(eq(20L), any())).thenReturn(Optional.empty());
        create(validRequest()).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CALENDAR_VERSION_NOT_FOUND"));
        assertNotSaved();
    }

    @Test
    void rejectsOutsideClassScope() throws Exception {
        when(provider.lockCalendarVersion(eq(20L), any())).thenReturn(Optional.of(version("DRAFT", false, Set.of())));
        create(validRequest()).andExpect(status().isForbidden());
        assertNotSaved();
        verify(provider, never()).findTopic(anyLong(), any());
    }

    @Test
    void requiresAuthenticationAndCreatePermission() throws Exception {
        mvc.perform(post(ENDPOINT).contentType(MediaType.APPLICATION_JSON).content(validRequest().toString()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(ENDPOINT).session(authenticatedSession("SESSION_READ"))
                        .contentType(MediaType.APPLICATION_JSON).content(validRequest().toString()))
                .andExpect(status().isForbidden());
        assertNotSaved();
        verifyNoInteractions(provider, checker);
    }

    @ParameterizedTest
    @ValueSource(strings = {"title", "topicId", "trainerId", "startTime", "endTime"})
    void rejectsMissingRequiredFields(String field) throws Exception {
        ObjectNode body = validRequest();
        body.remove(field);
        create(body).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("SESSION_VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors." + field).isArray());
        assertNotSaved();
        verifyNoInteractions(provider, checker);
    }

    @Test
    void rejectsBlankTitleAndNonPositiveReferences() throws Exception {
        create(validRequest().put("title", "  ").put("topicId", 0).put("trainerId", -1))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.title").isArray())
                .andExpect(jsonPath("$.fieldErrors.topicId").isArray())
                .andExpect(jsonPath("$.fieldErrors.trainerId").isArray());
        assertNotSaved();
    }

    @Test
    void rejectsOversizedFields() throws Exception {
        create(validRequest().put("title", "t".repeat(151)).put("room", "r".repeat(81))
                        .put("meetingLink", "https://example.com/" + "m".repeat(255)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.title").isArray())
                .andExpect(jsonPath("$.fieldErrors.room").isArray())
                .andExpect(jsonPath("$.fieldErrors.meetingLink").isArray());
        assertNotSaved();
    }

    @Test
    void rejectsMalformedMeetingLink() throws Exception {
        create(validRequest().put("meetingLink", "not-a-url"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.meetingLink").isArray());
        assertNotSaved();
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-10-19T08:00:00", "2026-10-19T07:00:00"})
    void rejectsEndNotAfterStart(String endTime) throws Exception {
        create(validRequest().put("endTime", endTime))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.endTime").isArray());
        assertNotSaved();
    }

    @Test
    void rejectsOutsideClassDates() throws Exception {
        create(validRequest().put("startTime", "2026-09-30T08:00:00"))
                .andExpect(status().isUnprocessableEntity());
        create(validRequest().put("endTime", "2026-11-01T10:00:00"))
                .andExpect(status().isUnprocessableEntity());
        assertNotSaved();
    }

    @Test
    void rejectsHoliday() throws Exception {
        when(provider.lockCalendarVersion(eq(20L), any())).thenReturn(Optional.of(
                version("DRAFT", true, Set.of(LocalDate.of(2026, 10, 19)))));
        create(validRequest()).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.startTime").isArray());
        assertNotSaved();
    }

    @Test
    void rejectsMissingOrWrongProgramTopic() throws Exception {
        when(provider.findTopic(eq(12L), any())).thenReturn(Optional.empty());
        create(validRequest()).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.topicId").isArray());
        when(provider.findTopic(eq(12L), any())).thenReturn(Optional.of(
                new SessionCreateContextProvider.TopicContext(99L, "Other program topic")));
        create(validRequest()).andExpect(status().isUnprocessableEntity());
        assertNotSaved();
    }

    @Test
    void rejectsMissingOrUnassignedTrainer() throws Exception {
        when(provider.findTrainer(eq(7L), eq(1L), eq(12L), any())).thenReturn(Optional.empty());
        create(validRequest()).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.trainerId").isArray());
        when(provider.findTrainer(eq(7L), eq(1L), eq(12L), any())).thenReturn(Optional.of(
                new SessionCreateContextProvider.TrainerContext("Trainer A", false)));
        create(validRequest()).andExpect(status().isUnprocessableEntity());
        assertNotSaved();
    }

    @Test
    void rejectsConflictBeforeSaving() throws Exception {
        when(checker.checkCandidate(eq(20L), any())).thenReturn(
                ConflictCheckResult.builder().calendarVersionId(20L).hasConflict(true).build());
        create(validRequest()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SESSION_CONFLICT"));
        assertNotSaved();
    }

    @Test
    void rejectsConflictValidationErrorsEvenWhenConflictFlagIsFalse() throws Exception {
        when(checker.checkCandidate(eq(20L), any())).thenReturn(ConflictCheckResult.builder()
                .calendarVersionId(20L).validationErrors(Map.of("room", List.of("Invalid room slot"))).build());
        create(validRequest()).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.room[0]").value("Invalid room slot"));
        assertNotSaved();
    }

    @Test
    void rejectsConflictPairsEvenWhenConflictFlagIsFalse() throws Exception {
        when(checker.checkCandidate(eq(20L), any())).thenReturn(ConflictCheckResult.builder()
                .calendarVersionId(20L).conflicts(List.of(new ConflictDTO())).build());
        create(validRequest()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SESSION_CONFLICT"));
        assertNotSaved();
    }

    @Test
    void validatesInputForDirectServiceCalls() {
        var sessionContext = authenticatedSession("SESSION_CREATE");
        SecurityContextHolder.setContext((org.springframework.security.core.context.SecurityContext)
                sessionContext.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY));
        CreateSessionRequest request = objectMapper.convertValue(validRequest(), CreateSessionRequest.class);
        request.setTitle("  ");
        assertThatThrownBy(() -> service.create(20L, request))
                .isInstanceOf(SessionRequestException.class)
                .satisfies(error -> assertThat(((SessionRequestException) error).getFieldErrors())
                        .containsKey("title"));
        assertNotSaved();
        verifyNoInteractions(provider, checker);
    }

    @Test
    void rejectsUnavailableConflictResult() throws Exception {
        when(checker.checkCandidate(eq(20L), any())).thenReturn(null);
        create(validRequest()).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SESSION_CONFLICT_CHECK_UNAVAILABLE"));
        assertNotSaved();
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "abc"})
    void rejectsInvalidVersionId(String id) throws Exception {
        mvc.perform(post("/api/v1/calendar-versions/" + id + "/sessions")
                        .session(authenticatedSession("SESSION_CREATE"))
                        .contentType(MediaType.APPLICATION_JSON).content(validRequest().toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        assertNotSaved();
    }

    @Test
    void rejectsMalformedBodyAndDateTime() throws Exception {
        mvc.perform(post(ENDPOINT).session(authenticatedSession("SESSION_CREATE"))
                        .contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest());
        create(validRequest().put("startTime", "invalid-time"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        assertNotSaved();
    }

    private ResultActions create(ObjectNode body) throws Exception {
        return mvc.perform(post(ENDPOINT).session(authenticatedSession("SESSION_CREATE"))
                .contentType(MediaType.APPLICATION_JSON).content(body.toString()));
    }

    private ObjectNode validRequest() {
        return objectMapper.createObjectNode().put("title", " MVC practice ").put("topicId", 12)
                .put("trainerId", 7).put("startTime", "2026-10-19T08:00:00")
                .put("endTime", "2026-10-19T10:00:00").put("room", "A101")
                .put("meetingLink", "https://example.com/lesson");
    }

    private MockHttpSession authenticatedSession(String permission) {
        var principal = new UserPrincipal(User.builder().id(7001L).email("hung-test@example.invalid").build(),
                List.of(new SimpleGrantedAuthority(permission)));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new TestingAuthenticationToken(principal, "unused", permission));
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return session;
    }

    private SessionCreateContextProvider.CalendarVersionContext version(
            String status, boolean canCreate, Set<LocalDate> holidays) {
        return new SessionCreateContextProvider.CalendarVersionContext(2L, status, 1L, "JAVA-10", 1L,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), holidays, canCreate);
    }

    private void assertNotSaved() {
        assertThat(repository.count()).isZero();
    }
}
