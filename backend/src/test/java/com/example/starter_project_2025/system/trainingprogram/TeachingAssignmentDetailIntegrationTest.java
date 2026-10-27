package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class TeachingAssignmentDetailIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ClassTrainingProgramRepository classPrograms;
    @Autowired SessionRepository sessions;
    @SpyBean ExternalApiService external;
    private String bearer;
    private Long assignmentId;
    private Long emptyAssignmentId;

    @BeforeEach
    void setUp() throws Exception {
        bearer = login("admin@example.com");
        var subjects = classPrograms.findByClassId(1L).orElseThrow().getProgram().getSubjects();
        var assignment = assignment(subjects.get(0));
        assignmentId = assignment.getId();
        emptyAssignmentId = assignment(subjects.get(1)).getId();
        for (Session.SessionStatus status : Session.SessionStatus.values()) {
            session(assignmentId, status, true);
        }
        session(assignmentId, Session.SessionStatus.COMPLETED, false);
        // Same class/trainer/subject is not sufficient evidence of assignment ownership.
        session(null, Session.SessionStatus.SCHEDULED, true);
        session(assignment(subjects.get(0)).getId(), Session.SessionStatus.SCHEDULED, true);
        sessions.flush();
    }

    @Test
    void detailsIncludeClassSubjectTrainerAndProgramVersionWithoutChangingExistingFields() throws Exception {
        mvc.perform(get("/api/teaching-assignments/{id}", assignmentId).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(assignmentId))
                .andExpect(jsonPath("$.classId").value(1)).andExpect(jsonPath("$.classCode").value("LOCAL_JAVA_01"))
                .andExpect(jsonPath("$.className").isNotEmpty()).andExpect(jsonPath("$.subjectVersion").value("1.0"))
                .andExpect(jsonPath("$.trainerEmail").value("trainer.an@example.com"))
                .andExpect(jsonPath("$.programCode").value("LOCAL_JAVA"))
                .andExpect(jsonPath("$.programVersion").value("1.0"))
                .andExpect(jsonPath("$.effectiveFrom").value("2026-01-01"));
    }

    @Test
    void sessionsMatchExactAssignmentAndIncludeCompletedCancelledAndArchivedRecords() throws Exception {
        mvc.perform(get("/api/teaching-assignments/{id}/sessions", assignmentId).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.content", hasSize(4)))
                .andExpect(jsonPath("$.content[0].status").value("SCHEDULED"))
                .andExpect(jsonPath("$.content[1].status").value("COMPLETED"))
                .andExpect(jsonPath("$.content[2].status").value("CANCELLED"))
                .andExpect(jsonPath("$.content[3].active").value(false))
                .andExpect(jsonPath("$.content[0].location").value("A101"))
                .andExpect(jsonPath("$.content[0].meetingUrl").value("https://example.com/meeting"))
                .andExpect(jsonPath("$.content[0].note").doesNotExist())
                .andExpect(jsonPath("$.content[0].cancelReason").doesNotExist());
    }

    @Test
    void paginatesWithoutRepeatingRowsWhenStartTimesAreEqual() throws Exception {
        var ids = new HashSet<Long>();
        for (int page = 0; page < 4; page++) {
            String response = mvc.perform(get("/api/teaching-assignments/{id}/sessions", assignmentId).header("Authorization", bearer)
                            .param("page", String.valueOf(page)).param("size", "1").param("sort", "startTime,asc"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.totalPages").value(4))
                    .andReturn().getResponse().getContentAsString();
            assertThat(ids.add(mapper.readTree(response).get("content").get(0).get("id").asLong())).isTrue();
        }
        mvc.perform(get("/api/teaching-assignments/{id}/sessions", assignmentId).header("Authorization", bearer).param("page", "99"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(4));
    }

    @Test
    void filtersStatusesAndHandlesAnAssignmentWithNoLinkedSessions() throws Exception {
        mvc.perform(get("/api/teaching-assignments/{id}/sessions", assignmentId).header("Authorization", bearer).param("status", "COMPLETED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/teaching-assignments/{id}/sessions", emptyAssignmentId).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void missingAssignmentAndInvalidQueryParametersReturnUsefulStatuses() throws Exception {
        for (String suffix : List.of("", "/sessions")) {
            mvc.perform(get("/api/teaching-assignments/999999" + suffix).header("Authorization", bearer))
                    .andExpect(status().isNotFound());
        }
        for (String[] invalid : new String[][]{{"status", "INVALID"}, {"sort", "trainerId,asc"}, {"size", "101"}, {"page", "100001"}}) {
            mvc.perform(get("/api/teaching-assignments/{id}/sessions", assignmentId).header("Authorization", bearer).param(invalid[0], invalid[1]))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void rejectsReadersWithoutAssignmentPermissionForEitherEndpoint() throws Exception {
        String student = login("student@example.com");
        for (String suffix : List.of("", "/sessions")) {
            mvc.perform(get("/api/teaching-assignments/" + assignmentId + suffix).header("Authorization", student))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void missingSharedProfilesKeepHistoricalAssignmentAndSessionsReadable() throws Exception {
        doThrow(new ExternalApiException("Class no longer available", 404, null)).when(external).fetchClassById(1L);
        doReturn(List.of()).when(external).fetchTrainers(null);
        mvc.perform(get("/api/teaching-assignments/{id}", assignmentId).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.classId").value(1))
                .andExpect(jsonPath("$.trainerId").value(1)).andExpect(jsonPath("$.className").isEmpty())
                .andExpect(jsonPath("$.trainerName").isEmpty());
        mvc.perform(get("/api/teaching-assignments/{id}/sessions", assignmentId).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(4));
    }

    @Test
    void sessionHistoryRemainsAvailableDuringSharedProfileOutage() throws Exception {
        doThrow(new ExternalApiException("Shared service unavailable", 503, null)).when(external).fetchClassById(1L);
        mvc.perform(get("/api/teaching-assignments/{id}", assignmentId).header("Authorization", bearer))
                .andExpect(status().isServiceUnavailable());
        mvc.perform(get("/api/teaching-assignments/{id}/sessions", assignmentId).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(4));
    }

    private TeachingAssignment assignment(ProgramSubject subject) {
        var assignment = new TeachingAssignment();
        assignment.setClassId(1L);
        assignment.setProgramSubject(subject);
        assignment.setTrainerId(1L);
        assignment.setRole(AssignmentRole.MAIN);
        assignment.setEffectiveFrom(LocalDate.of(2026, 1, 1));
        assignment.setEffectiveTo(LocalDate.of(2026, 12, 31));
        return assignments.saveAndFlush(assignment);
    }

    private void session(Long assignmentId, Session.SessionStatus status, boolean active) {
        var session = new Session();
        session.setClassId(1L);
        session.setTopicId(1L);
        session.setTrainerId(1L);
        session.setTeachingAssignmentId(assignmentId);
        session.setTitle("Session " + status);
        session.setStartTime(LocalDateTime.of(2026, 11, 1, 9, 0));
        session.setEndTime(LocalDateTime.of(2026, 11, 1, 10, 0));
        session.setLocation("A101");
        session.setMeetingUrl("https://example.com/meeting");
        session.setStatus(status);
        session.setIsActive(active);
        session.setNote("Private trainer notes");
        session.setCancelReason("Private cancellation details");
        sessions.save(session);
    }

    private String login(String email) throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + mapper.readTree(response).get("accessToken").asText();
    }
}
