package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SessionLifecycleIntegrationTest {

    private static final long CLASS_ID = 101L;
    private static final long OTHER_CLASS_ID = 102L;
    private static final long TOPIC_ID = 500L;
    private static final long TRAINER_ID = 7L;
    private static final long OTHER_TRAINER_ID = 8L;

    private static final LocalDateTime NINE = LocalDateTime.of(2030, 3, 4, 9, 0);
    private static final LocalDateTime ELEVEN = LocalDateTime.of(2030, 3, 4, 11, 0);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @MockBean
    private ExternalApiService externalApiService;

    private String adminToken;
    private String studentToken;

    @BeforeEach
    void setUp() {
        sessionRepository.deleteAll();

        transactionTemplate.executeWithoutResult(status -> {
            adminToken = tokenFor("admin@example.com");
            studentToken = tokenFor("student@example.com");
        });

        when(externalApiService.fetchClassById(anyLong())).thenAnswer(invocation ->
                ExternalClassDTO.builder().id(invocation.getArgument(0)).code("CLS-" + invocation.getArgument(0)).build());
        when(externalApiService.fetchTrainers("active")).thenReturn(List.of(
                trainer(TRAINER_ID), trainer(OTHER_TRAINER_ID)));
    }

    // ───────────────────────────── create ─────────────────────────────

    @Test
    @DisplayName("POST /api/sessions - creates a SCHEDULED session")
    void create_Success_ReturnsScheduledSession() throws Exception {
        performPost("/api/sessions", adminToken, sessionBody(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.classId").value(CLASS_ID))
                .andExpect(jsonPath("$.topicId").value(TOPIC_ID))
                .andExpect(jsonPath("$.trainerId").value(TRAINER_ID))
                .andExpect(jsonPath("$.location").value("A101"))
                .andExpect(jsonPath("$.cancelReason").value(nullValue()));
    }

    @Test
    @DisplayName("POST /api/sessions - a status sent by the client is ignored")
    void create_ClientSuppliedStatus_IsIgnored() throws Exception {
        Map<String, Object> body = sessionBody(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, null);
        body.put("status", "COMPLETED");
        body.put("cancelReason", "forged");

        performPost("/api/sessions", adminToken, body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.cancelReason").value(nullValue()));
    }

    @Test
    @DisplayName("POST /api/sessions - a class unknown to the master system is rejected (400)")
    void create_UnknownClass_Returns400() throws Exception {
        when(externalApiService.fetchClassById(999L)).thenThrow(new ExternalApiException("not found", 404, "{}"));

        performPost("/api/sessions", adminToken, sessionBody(999L, TRAINER_ID, "Intro", NINE, ELEVEN, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.classId", hasItem(containsString("does not exist"))));
        assertEquals(0, sessionRepository.count());
    }

    @Test
    @DisplayName("POST /api/sessions - a trainer that is not active in the master system is rejected (400)")
    void create_UnknownTrainer_Returns400() throws Exception {
        performPost("/api/sessions", adminToken, sessionBody(CLASS_ID, 99L, "Intro", NINE, ELEVEN, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.trainerId", hasItem(containsString("not an active trainer"))));
        assertEquals(0, sessionRepository.count());
    }

    @Test
    @DisplayName("POST /api/sessions - nothing is written when the master system is unreachable (503)")
    void create_MasterSystemDown_Returns503AndWritesNothing() throws Exception {
        when(externalApiService.fetchClassById(anyLong()))
                .thenThrow(new ExternalApiException("master down", new RuntimeException("connection refused")));

        performPost("/api/sessions", adminToken, sessionBody(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, null))
                .andExpect(status().isServiceUnavailable());
        assertEquals(0, sessionRepository.count());
    }

    @Test
    @DisplayName("POST /api/sessions - an upstream 401 is not forwarded as the caller's own 401")
    void create_MasterSystemRejectsOurToken_Returns502NotUnauthorized() throws Exception {
        when(externalApiService.fetchClassById(anyLong())).thenThrow(new ExternalApiException("unauthorized", 401, "{}"));

        performPost("/api/sessions", adminToken, sessionBody(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, null))
                .andExpect(status().isBadGateway());
    }

    @Test
    @DisplayName("POST /api/sessions - end time must be after start time (400)")
    void create_EndNotAfterStart_Returns400() throws Exception {
        performPost("/api/sessions", adminToken, sessionBody(CLASS_ID, TRAINER_ID, "Intro", ELEVEN, NINE, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.endTime", hasItem("End time must be after start time")));
    }

    @Test
    @DisplayName("POST /api/sessions - required fields are validated (400)")
    void create_MissingRequiredFields_Returns400() throws Exception {
        performPost("/api/sessions", adminToken, Map.of("isActive", true))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.classId").exists())
                .andExpect(jsonPath("$.errors.topicId").exists())
                .andExpect(jsonPath("$.errors.trainerId").exists())
                .andExpect(jsonPath("$.errors.title").exists())
                .andExpect(jsonPath("$.errors.startTime").exists())
                .andExpect(jsonPath("$.errors.endTime").exists());
    }

    @Test
    @DisplayName("POST /api/sessions - requires SESSION_CREATE (403) and authentication (401)")
    void create_WithoutPermission_IsRejected() throws Exception {
        Map<String, Object> body = sessionBody(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, null);

        performPost("/api/sessions", studentToken, body).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
        assertEquals(0, sessionRepository.count());
    }

    // ───────────────────────── schedule conflicts ─────────────────────────

    @Test
    @DisplayName("POST /api/sessions - the same trainer cannot teach two overlapping sessions (409)")
    void create_TrainerOverlap_Returns409() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Existing", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPost("/api/sessions", adminToken,
                sessionBody(OTHER_CLASS_ID, TRAINER_ID, "Clash", NINE.plusHours(1), ELEVEN.plusHours(1), "B202"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message", containsString("Trainer #" + TRAINER_ID)))
                .andExpect(jsonPath("$.message", containsString("Existing")));
        assertEquals(1, sessionRepository.count());
    }

    @Test
    @DisplayName("POST /api/sessions - a class cannot attend two overlapping sessions (409)")
    void create_ClassOverlap_Returns409() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Existing", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPost("/api/sessions", adminToken,
                sessionBody(CLASS_ID, OTHER_TRAINER_ID, "Clash", NINE.plusMinutes(30), ELEVEN, "B202"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("Class #" + CLASS_ID)));
    }

    @Test
    @DisplayName("POST /api/sessions - a room cannot host two overlapping sessions, ignoring case (409)")
    void create_RoomOverlap_Returns409() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Existing", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPost("/api/sessions", adminToken,
                sessionBody(OTHER_CLASS_ID, OTHER_TRAINER_ID, "Clash", NINE, ELEVEN, " a101 "))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("Room 'a101'")));
    }

    @Test
    @DisplayName("POST /api/sessions - back-to-back sessions do not conflict")
    void create_AdjacentSlot_IsAllowed() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Morning", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPost("/api/sessions", adminToken,
                sessionBody(CLASS_ID, TRAINER_ID, "Afternoon", ELEVEN, ELEVEN.plusHours(2), "A101"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/sessions - a cancelled session no longer blocks its slot")
    void create_OverlapWithCancelledSession_IsAllowed() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Cancelled", NINE, ELEVEN, "A101", Session.SessionStatus.CANCELLED);

        performPost("/api/sessions", adminToken, sessionBody(CLASS_ID, TRAINER_ID, "Replacement", NINE, ELEVEN, "A101"))
                .andExpect(status().isOk());
    }

    // ─────────────────────────────── update ───────────────────────────────

    @Test
    @DisplayName("PUT /api/sessions/{id} - a session cannot be moved to another class or topic (400)")
    void update_ChangingClassOrTopic_Returns400() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        Map<String, Object> body = new HashMap<>();
        body.put("classId", OTHER_CLASS_ID);
        body.put("topicId", TOPIC_ID + 1);
        performPut("/api/sessions/" + session.getId(), adminToken, body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.classId").exists())
                .andExpect(jsonPath("$.errors.topicId").exists());

        Session reloaded = sessionRepository.findById(session.getId()).orElseThrow();
        assertEquals(CLASS_ID, reloaded.getClassId());
        assertEquals(TOPIC_ID, reloaded.getTopicId());
    }

    @Test
    @DisplayName("PUT /api/sessions/{id} - keeping class/topic and editing the title succeeds without a self-conflict")
    void update_OwnSlot_DoesNotConflictWithItself() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        Map<String, Object> body = sessionBody(CLASS_ID, TRAINER_ID, "Intro v2", NINE, ELEVEN, "A101");
        performPut("/api/sessions/" + session.getId(), adminToken, body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Intro v2"))
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
    }

    @Test
    @DisplayName("PUT /api/sessions/{id} - moving into another session's slot is rejected (409)")
    void update_TimeOverlap_Returns409() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Other", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);
        Session mine = saveSession(OTHER_CLASS_ID, TRAINER_ID, "Mine", ELEVEN, ELEVEN.plusHours(2), "B202",
                Session.SessionStatus.SCHEDULED);

        Map<String, Object> body = new HashMap<>();
        body.put("startTime", NINE.plusHours(1).toString());
        body.put("endTime", ELEVEN.plusHours(1).toString());
        performPut("/api/sessions/" + mine.getId(), adminToken, body)
                .andExpect(status().isConflict());

        Session reloaded = sessionRepository.findById(mine.getId()).orElseThrow();
        assertEquals(ELEVEN, reloaded.getStartTime());
    }

    @Test
    @DisplayName("PUT /api/sessions/{id} - a trainer that is not active is rejected (400)")
    void update_ChangingToUnknownTrainer_Returns400() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPut("/api/sessions/" + session.getId(), adminToken, Map.of("trainerId", 99L))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.trainerId").exists());
    }

    @Test
    @DisplayName("PUT /api/sessions/{id} - completed and cancelled sessions are read-only (400)")
    void update_FinishedSession_Returns400() throws Exception {
        Session completed = saveSession(CLASS_ID, TRAINER_ID, "Done", NINE, ELEVEN, "A101", Session.SessionStatus.COMPLETED);
        Session cancelled = saveSession(CLASS_ID, TRAINER_ID, "Gone", NINE.plusDays(1), ELEVEN.plusDays(1), "A101",
                Session.SessionStatus.CANCELLED);

        performPut("/api/sessions/" + completed.getId(), adminToken, Map.of("title", "x"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.status").exists());
        performPut("/api/sessions/" + cancelled.getId(), adminToken, Map.of("title", "x"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.status").exists());
    }

    // ───────────────────────────── reschedule ─────────────────────────────

    @Test
    @DisplayName("PATCH /api/sessions/{id}/reschedule - moves the slot and keeps class/topic/trainer/title")
    void reschedule_Success_KeepsContext() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);
        LocalDateTime newStart = NINE.plusDays(2);

        performPatch("/api/sessions/" + session.getId() + "/reschedule", adminToken,
                Map.of("startTime", newStart.toString(), "endTime", newStart.plusHours(2).toString(), "location", "C303"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(session.getId()))
                .andExpect(jsonPath("$.startTime").value(iso(newStart)))
                .andExpect(jsonPath("$.location").value("C303"))
                .andExpect(jsonPath("$.classId").value(CLASS_ID))
                .andExpect(jsonPath("$.topicId").value(TOPIC_ID))
                .andExpect(jsonPath("$.trainerId").value(TRAINER_ID))
                .andExpect(jsonPath("$.title").value("Intro"))
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
    }

    @Test
    @DisplayName("PATCH /api/sessions/{id}/reschedule - without a location the current room is kept")
    void reschedule_WithoutLocation_KeepsRoom() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPatch("/api/sessions/" + session.getId() + "/reschedule", adminToken,
                Map.of("startTime", NINE.plusDays(1).toString(), "endTime", ELEVEN.plusDays(1).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location").value("A101"));
    }

    @Test
    @DisplayName("PATCH /api/sessions/{id}/reschedule - a conflicting slot is rejected and nothing changes (409)")
    void reschedule_Conflict_Returns409() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Other", NINE.plusDays(1), ELEVEN.plusDays(1), "B202", Session.SessionStatus.SCHEDULED);
        Session mine = saveSession(OTHER_CLASS_ID, TRAINER_ID, "Mine", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPatch("/api/sessions/" + mine.getId() + "/reschedule", adminToken,
                Map.of("startTime", NINE.plusDays(1).toString(), "endTime", ELEVEN.plusDays(1).toString()))
                .andExpect(status().isConflict());

        assertEquals(NINE, sessionRepository.findById(mine.getId()).orElseThrow().getStartTime());
    }

    @Test
    @DisplayName("PATCH /api/sessions/{id}/reschedule - only scheduled sessions can be rescheduled (409)")
    void reschedule_NonScheduled_Returns409() throws Exception {
        Session completed = saveSession(CLASS_ID, TRAINER_ID, "Done", NINE, ELEVEN, "A101", Session.SessionStatus.COMPLETED);
        Session cancelled = saveSession(CLASS_ID, TRAINER_ID, "Gone", NINE.plusDays(1), ELEVEN.plusDays(1), "A101",
                Session.SessionStatus.CANCELLED);
        Map<String, Object> body = Map.of("startTime", NINE.plusDays(5).toString(), "endTime", ELEVEN.plusDays(5).toString());

        performPatch("/api/sessions/" + completed.getId() + "/reschedule", adminToken, body).andExpect(status().isConflict());
        performPatch("/api/sessions/" + cancelled.getId() + "/reschedule", adminToken, body).andExpect(status().isConflict());
    }

    @Test
    @DisplayName("PATCH /api/sessions/{id}/reschedule - validates the time range (400) and the id (404)")
    void reschedule_InvalidInput() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPatch("/api/sessions/" + session.getId() + "/reschedule", adminToken,
                Map.of("startTime", ELEVEN.toString(), "endTime", NINE.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.endTime").exists());
        performPatch("/api/sessions/" + session.getId() + "/reschedule", adminToken, Map.of())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.startTime").exists());
        performPatch("/api/sessions/987654/reschedule", adminToken,
                Map.of("startTime", NINE.toString(), "endTime", ELEVEN.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PATCH /api/sessions/{id}/reschedule - requires SESSION_UPDATE (403)")
    void reschedule_AsStudent_Returns403() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPatch("/api/sessions/" + session.getId() + "/reschedule", studentToken,
                Map.of("startTime", NINE.plusDays(1).toString(), "endTime", ELEVEN.plusDays(1).toString()))
                .andExpect(status().isForbidden());
    }

    // ───────────────────────────── duplicate ──────────────────────────────

    @Test
    @DisplayName("POST /api/sessions/{id}/duplicate - creates a new SCHEDULED session in the same context")
    void duplicate_FromCompleted_CreatesFreshScheduledSession() throws Exception {
        Session source = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.COMPLETED);
        source.setNote("Bring laptops");
        sessionRepository.save(source);
        LocalDateTime nextWeek = NINE.plusWeeks(1);

        performPost("/api/sessions/" + source.getId() + "/duplicate", adminToken,
                Map.of("startTime", nextWeek.toString(), "endTime", nextWeek.plusHours(2).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", not(source.getId().intValue())))
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.cancelReason").value(nullValue()))
                .andExpect(jsonPath("$.classId").value(CLASS_ID))
                .andExpect(jsonPath("$.topicId").value(TOPIC_ID))
                .andExpect(jsonPath("$.trainerId").value(TRAINER_ID))
                .andExpect(jsonPath("$.title").value("Intro"))
                .andExpect(jsonPath("$.note").value("Bring laptops"))
                .andExpect(jsonPath("$.location").value("A101"))
                .andExpect(jsonPath("$.startTime").value(iso(nextWeek)));

        assertEquals(2, sessionRepository.count());
        assertEquals(Session.SessionStatus.COMPLETED, sessionRepository.findById(source.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("POST /api/sessions/{id}/duplicate - a cancelled source does not pass its reason on")
    void duplicate_FromCancelled_DoesNotCopyCancellation() throws Exception {
        Session source = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.CANCELLED);
        source.setCancelReason("Trainer sick");
        sessionRepository.save(source);

        performPost("/api/sessions/" + source.getId() + "/duplicate", adminToken,
                Map.of("startTime", NINE.plusDays(3).toString(), "endTime", ELEVEN.plusDays(3).toString(), "location", "B202"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.cancelReason").value(nullValue()))
                .andExpect(jsonPath("$.location").value("B202"));
    }

    @Test
    @DisplayName("POST /api/sessions/{id}/duplicate - the copy is validated like any new session (409 / 400 / 404 / 403)")
    void duplicate_IsValidatedLikeCreate() throws Exception {
        Session source = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPost("/api/sessions/" + source.getId() + "/duplicate", adminToken,
                Map.of("startTime", NINE.toString(), "endTime", ELEVEN.toString()))
                .andExpect(status().isConflict());
        performPost("/api/sessions/" + source.getId() + "/duplicate", adminToken,
                Map.of("startTime", ELEVEN.toString(), "endTime", NINE.toString()))
                .andExpect(status().isBadRequest());
        performPost("/api/sessions/987654/duplicate", adminToken,
                Map.of("startTime", NINE.plusDays(1).toString(), "endTime", ELEVEN.plusDays(1).toString()))
                .andExpect(status().isNotFound());
        performPost("/api/sessions/" + source.getId() + "/duplicate", studentToken,
                Map.of("startTime", NINE.plusDays(1).toString(), "endTime", ELEVEN.plusDays(1).toString()))
                .andExpect(status().isForbidden());
        assertEquals(1, sessionRepository.count());
    }

    @Test
    @DisplayName("POST /api/sessions/{id}/duplicate - the class is re-verified against the master system")
    void duplicate_ClassNoLongerExists_Returns400() throws Exception {
        Session source = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);
        when(externalApiService.fetchClassById(CLASS_ID)).thenThrow(new ExternalApiException("not found", 404, "{}"));

        performPost("/api/sessions/" + source.getId() + "/duplicate", adminToken,
                Map.of("startTime", NINE.plusDays(1).toString(), "endTime", ELEVEN.plusDays(1).toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.classId").exists());
    }

    // ─────────────────────────── complete / cancel ───────────────────────────

    @Test
    @DisplayName("PATCH /api/sessions/{id}/complete - SCHEDULED becomes COMPLETED, then it is final (409)")
    void complete_Success_ThenFinal() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPatch("/api/sessions/" + session.getId() + "/complete", adminToken, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        performPatch("/api/sessions/" + session.getId() + "/complete", adminToken, null).andExpect(status().isConflict());
        performPatch("/api/sessions/" + session.getId() + "/cancel", adminToken, Map.of("cancelReason", "late"))
                .andExpect(status().isConflict());
        assertEquals(Session.SessionStatus.COMPLETED, sessionRepository.findById(session.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("PATCH /api/sessions/{id}/complete - a cancelled session cannot be completed (409); unknown id is 404")
    void complete_InvalidState() throws Exception {
        Session cancelled = saveSession(CLASS_ID, TRAINER_ID, "Gone", NINE, ELEVEN, "A101", Session.SessionStatus.CANCELLED);

        performPatch("/api/sessions/" + cancelled.getId() + "/complete", adminToken, null).andExpect(status().isConflict());
        performPatch("/api/sessions/987654/complete", adminToken, null).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PATCH /api/sessions/{id}/complete and /cancel - require SESSION_UPDATE (403)")
    void completeAndCancel_AsStudent_Return403() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPatch("/api/sessions/" + session.getId() + "/complete", studentToken, null).andExpect(status().isForbidden());
        performPatch("/api/sessions/" + session.getId() + "/cancel", studentToken, Map.of("cancelReason", "no"))
                .andExpect(status().isForbidden());
        assertEquals(Session.SessionStatus.SCHEDULED, sessionRepository.findById(session.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("PATCH /api/sessions/{id}/cancel - stores the reason; blank reason (400), repeat (409), unknown id (404)")
    void cancel_Rules() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPatch("/api/sessions/" + session.getId() + "/cancel", adminToken, Map.of("cancelReason", "  "))
                .andExpect(status().isBadRequest());
        performPatch("/api/sessions/" + session.getId() + "/cancel", adminToken, Map.of("cancelReason", " Trainer sick "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelReason").value("Trainer sick"));
        performPatch("/api/sessions/" + session.getId() + "/cancel", adminToken, Map.of("cancelReason", "again"))
                .andExpect(status().isConflict());
        performPatch("/api/sessions/987654/cancel", adminToken, Map.of("cancelReason", "x"))
                .andExpect(status().isNotFound());
    }

    // ───────────────────────────── list / filter ──────────────────────────────

    @Test
    @DisplayName("GET /api/sessions - filters by class and sorts chronologically")
    void list_FilterByClass_SortedByStart() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Second", NINE.plusDays(1), ELEVEN.plusDays(1), "A101", Session.SessionStatus.SCHEDULED);
        saveSession(CLASS_ID, TRAINER_ID, "First", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);
        saveSession(OTHER_CLASS_ID, OTHER_TRAINER_ID, "Elsewhere", NINE, ELEVEN, "B202", Session.SessionStatus.SCHEDULED);

        mockMvc.perform(get("/api/sessions").param("classId", String.valueOf(CLASS_ID)).param("sort", "startTime,asc")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[0].title").value("First"))
                .andExpect(jsonPath("$.content[1].title").value("Second"));
    }

    @Test
    @DisplayName("GET /api/sessions - a repeated filter parameter matches any of its values")
    void list_MultiValueFilters_MatchAnyValue() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "A", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);
        saveSession(OTHER_CLASS_ID, OTHER_TRAINER_ID, "B", NINE.plusDays(1), ELEVEN.plusDays(1), "B202", Session.SessionStatus.COMPLETED);
        saveSession(103L, TRAINER_ID, "C", NINE.plusDays(2), ELEVEN.plusDays(2), "C303", Session.SessionStatus.CANCELLED);

        mockMvc.perform(get("/api/sessions").param("classId", "101", "102").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)));
        mockMvc.perform(get("/api/sessions").param("status", "SCHEDULED", "CANCELLED").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)));
        mockMvc.perform(get("/api/sessions").param("trainerId", String.valueOf(TRAINER_ID)).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    @DisplayName("GET /api/sessions - fromDate / toDate bound the time window")
    void list_DateWindow_FiltersByTime() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Early", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);
        saveSession(CLASS_ID, TRAINER_ID, "Late", NINE.plusDays(10), ELEVEN.plusDays(10), "A101", Session.SessionStatus.SCHEDULED);

        mockMvc.perform(get("/api/sessions")
                        .param("fromDate", "2030-03-10T00:00:00").param("toDate", "2030-03-20T23:59:59")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].title").value("Late"));
    }

    @Test
    @DisplayName("GET /api/sessions/{id} - unknown id is 404")
    void getById_Unknown_Returns404() throws Exception {
        mockMvc.perform(get("/api/sessions/987654").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    // ───────────────────────────── import / export ─────────────────────────────

    @Test
    @DisplayName("POST /api/sessions/import - every row is validated like a created session; a rejected row fails alone")
    void import_Csv_ValidatesEachRow() throws Exception {
        when(externalApiService.fetchClassById(999L)).thenThrow(new ExternalApiException("not found", 404, "{}"));
        String csv = """
                Class ID,Topic ID,Trainer ID,Session Title,Start Time,End Time,Location / Room
                101,500,7,Imported A,2030-05-01T09:00:00,2030-05-01T11:00:00,Lab 1
                101,500,7,Imported bad time,2030-05-02T11:00:00,2030-05-02T09:00:00,Lab 1
                101,500,7,Imported B,2030-05-03T09:00:00,2030-05-03T11:00:00,Lab 1
                102,500,7,Imported clash,2030-05-01T10:00:00,2030-05-01T12:00:00,Lab 2
                999,500,8,Imported unknown class,2030-05-04T09:00:00,2030-05-04T11:00:00,Lab 3
                101,500,99,Imported unknown trainer,2030-05-05T09:00:00,2030-05-05T11:00:00,Lab 3
                101,0,8,Imported bad topic,2030-05-06T09:00:00,2030-05-06T11:00:00,Lab 3
                """;

        mockMvc.perform(multipart("/api/sessions/import")
                        .file(new MockMultipartFile("file", "sessions.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(2))
                .andExpect(jsonPath("$.failureCount").value(5))
                .andExpect(jsonPath("$.errors[?(@.rowNumber==3)].message", hasItem(containsString("End time must be after start time"))))
                .andExpect(jsonPath("$.errors[?(@.rowNumber==5)].message", hasItem(containsString("Trainer #7"))))
                .andExpect(jsonPath("$.errors[?(@.rowNumber==6)].message", hasItem(containsString("Class #999 does not exist"))))
                .andExpect(jsonPath("$.errors[?(@.rowNumber==7)].message", hasItem(containsString("not an active trainer"))))
                .andExpect(jsonPath("$.errors[?(@.rowNumber==8)].message", hasItem(containsString("Topic ID must be a positive number"))));

        List<Session> imported = sessionRepository.findByClassId(CLASS_ID);
        assertEquals(2, imported.size());
        imported.forEach(session -> assertEquals(Session.SessionStatus.SCHEDULED, session.getStatus()));
        assertEquals(0, sessionRepository.findByClassId(OTHER_CLASS_ID).size());
    }

    @Test
    @DisplayName("POST /api/sessions/import - rows of one file also conflict with each other")
    void import_Csv_RowsConflictWithEarlierRowsOfTheSameFile() throws Exception {
        String csv = """
                Class ID,Topic ID,Trainer ID,Session Title,Start Time,End Time,Location / Room
                101,500,7,First,2030-06-01T09:00:00,2030-06-01T11:00:00,Lab 1
                101,500,8,Second same class,2030-06-01T10:00:00,2030-06-01T12:00:00,Lab 2
                """;

        mockMvc.perform(multipart("/api/sessions/import")
                        .file(new MockMultipartFile("file", "sessions.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(1))
                .andExpect(jsonPath("$.failureCount").value(1))
                .andExpect(jsonPath("$.errors[0].message", containsString("Class #101")));
    }

    @Test
    @DisplayName("POST /api/sessions/import - the master system is asked once per class and once for trainers, not per row")
    void import_Csv_AsksMasterSystemOncePerClass() throws Exception {
        String csv = """
                Class ID,Topic ID,Trainer ID,Session Title,Start Time,End Time,Location / Room
                101,500,7,One,2030-07-01T09:00:00,2030-07-01T10:00:00,Lab 1
                101,500,7,Two,2030-07-02T09:00:00,2030-07-02T10:00:00,Lab 1
                101,500,7,Three,2030-07-03T09:00:00,2030-07-03T10:00:00,Lab 1
                """;

        mockMvc.perform(multipart("/api/sessions/import")
                        .file(new MockMultipartFile("file", "sessions.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(3));

        verify(externalApiService, times(1)).fetchClassById(CLASS_ID);
        verify(externalApiService, times(1)).fetchTrainers("active");
    }

    // ───────────────────────── text validation (never reaches the database) ─────────────────────────

    @Test
    @DisplayName("POST /api/sessions - an over-long title or room and a non-positive topic are rejected (400), not a 500")
    void create_InvalidText_Returns400() throws Exception {
        Map<String, Object> body = sessionBody(CLASS_ID, TRAINER_ID, "x".repeat(151), NINE, ELEVEN, "r".repeat(151));
        body.put("topicId", 0);

        performPost("/api/sessions", adminToken, body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.title", hasItem(containsString("150"))))
                .andExpect(jsonPath("$.errors.location", hasItem(containsString("150"))))
                .andExpect(jsonPath("$.errors.topicId", hasItem(containsString("positive"))));
        assertEquals(0, sessionRepository.count());
    }

    @Test
    @DisplayName("POST /api/sessions - the title is stored trimmed")
    void create_TitleIsTrimmed() throws Exception {
        performPost("/api/sessions", adminToken, sessionBody(CLASS_ID, TRAINER_ID, "  Padded title  ", NINE, ELEVEN, null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Padded title"));
    }

    @Test
    @DisplayName("PUT /api/sessions/{id} - a blank or over-long title and room are rejected (400); a valid one is trimmed")
    void update_InvalidText_Returns400() throws Exception {
        Session session = saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        performPut("/api/sessions/" + session.getId(), adminToken, Map.of("title", "   "))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.title").exists());
        performPut("/api/sessions/" + session.getId(), adminToken, Map.of("title", "x".repeat(151)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.title").exists());
        performPut("/api/sessions/" + session.getId(), adminToken, Map.of("location", "r".repeat(151)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.location").exists());
        assertEquals("Intro", sessionRepository.findById(session.getId()).orElseThrow().getTitle());

        performPut("/api/sessions/" + session.getId(), adminToken, Map.of("title", "  Renamed  ", "location", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Renamed"))
                .andExpect(jsonPath("$.location").value(nullValue()));
    }

    @Test
    @DisplayName("POST /api/sessions/import and GET /export - require SESSION_CREATE / SESSION_READ (403)")
    void importExport_AsStudent_Return403() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "sessions.csv", "text/csv", "Class ID\n1\n".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/sessions/import").file(file).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/sessions/export").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());
        assertEquals(0, sessionRepository.count());
    }

    @Test
    @DisplayName("GET /api/sessions/export - still works for an authorised user")
    void export_AsAdmin_ReturnsFile() throws Exception {
        saveSession(CLASS_ID, TRAINER_ID, "Intro", NINE, ELEVEN, "A101", Session.SessionStatus.SCHEDULED);

        mockMvc.perform(get("/api/sessions/export").param("format", "CSV").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // ───────────────────────────────── helpers ──────────────────────────────────

    private String tokenFor(String email) {
        UserDetails user = userDetailsService.loadUserByUsername(email);
        return refreshTokenService.generateAccessToken(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    /** The format the API serialises LocalDateTime with (LocalDateTime.toString() drops zero seconds). */
    private static String iso(LocalDateTime value) {
        return value.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }

    private static ExternalTrainerDTO trainer(long id) {
        return ExternalTrainerDTO.builder().id(id).name("Trainer " + id).email("t" + id + "@example.com").status("active").build();
    }

    private Session saveSession(long classId, long trainerId, String title, LocalDateTime start, LocalDateTime end,
                                String location, Session.SessionStatus status) {
        return sessionRepository.save(Session.builder()
                .classId(classId)
                .topicId(TOPIC_ID)
                .trainerId(trainerId)
                .title(title)
                .startTime(start)
                .endTime(end)
                .location(location)
                .status(status)
                .build());
    }

    private static Map<String, Object> sessionBody(long classId, long trainerId, String title,
                                                   LocalDateTime start, LocalDateTime end, String location) {
        Map<String, Object> body = new HashMap<>();
        body.put("classId", classId);
        body.put("topicId", TOPIC_ID);
        body.put("trainerId", trainerId);
        body.put("title", title);
        body.put("startTime", start.toString());
        body.put("endTime", end.toString());
        body.put("location", location);
        body.put("isActive", true);
        return body;
    }

    private ResultActions performPost(String url, String token, Object body) throws Exception {
        return mockMvc.perform(post(url).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions performPut(String url, String token, Object body) throws Exception {
        return mockMvc.perform(put(url).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions performPatch(String url, String token, Object body) throws Exception {
        var request = patch(url).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
        if (body != null) {
            request.content(objectMapper.writeValueAsString(body));
        }
        return mockMvc.perform(request);
    }
}
