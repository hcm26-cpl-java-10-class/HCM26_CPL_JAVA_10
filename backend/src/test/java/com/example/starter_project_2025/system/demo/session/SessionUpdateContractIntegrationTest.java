package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Real HTTP controller, service, assignment guard and JPA transactions in a test-only H2 database.
 * No outer test transaction: a rejected request must finish rollback before persisted state is read.
 * Fixture rows are never inserted into the running application's database.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:session_update_contract_test;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles({"local", "schedule-demo"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SessionUpdateContractIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SessionRepository sessions;
    @Autowired TeachingAssignmentRepository assignments;

    private Session imported;
    private String bearer;

    @BeforeEach
    void arrangeImportedLegacySession() throws Exception {
        sessions.deleteAll();
        assertThat(assignments.count()).isZero();
        var fixture = Session.builder()
                .classId(1L).topicId(1L).trainerId(1L)
                .teachingAssignmentId(null).roomId(1L).location("A101")
                .title("Imported Java session")
                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 11, 2, 10, 0))
                .status(Session.SessionStatus.SCHEDULED)
                .note("Original imported note")
                .isActive(true).createdBy(123L).updatedBy(123L)
                .build();
        imported = sessions.saveAndFlush(fixture);
        // Reload the persisted timestamps/audit fields for the rollback comparison.
        imported = sessions.findById(imported.getId()).orElseThrow();
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", "admin@example.com", "password", "password123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        bearer = "Bearer " + json.readTree(response).get("accessToken").asText();
    }

    @Test
    void legacyNullAssignmentUpdatesWithoutRevisionOrSynthesizingAStoredAssignment() throws Exception {
        var request = updateRequest(null, "Edited legacy session");
        assertThat(request.has("revision")).isFalse();
        mvc.perform(get("/api/sessions/{id}", imported.getId()).header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.teachingAssignmentId").value(nullValue()));

        assertScheduleCheckAccepts(request);
        mvc.perform(put("/api/sessions/{id}", imported.getId())
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(imported.getId()))
                .andExpect(jsonPath("$.title").value("Edited legacy session"))
                .andExpect(jsonPath("$.teachingAssignmentId").value(nullValue()))
                .andExpect(jsonPath("$.revision").doesNotExist());

        var persisted = sessions.findById(imported.getId()).orElseThrow();
        assertThat(persisted.getTeachingAssignmentId()).isNull();
        assertThat(persisted.getTitle()).isEqualTo("Edited legacy session");
        assertThat(persisted.getNote()).isEqualTo(imported.getNote());
        assertThat(persisted.getStatus()).isEqualTo(Session.SessionStatus.SCHEDULED);
        assertThat(persisted.getCreatedAt()).isEqualTo(imported.getCreatedAt());
        assertThat(persisted.getCreatedBy()).isEqualTo(imported.getCreatedBy());
        assertThat(persisted.getClassId()).isEqualTo(imported.getClassId());
        assertThat(persisted.getTopicId()).isEqualTo(imported.getTopicId());
        assertThat(persisted.getTrainerId()).isEqualTo(imported.getTrainerId());
        assertThat(assignments.count()).isZero();
        assertThat(sessions.count()).isEqualTo(1);
    }

    @Test
    void demoReferenceCanPassScheduleCheckButExplicitMissingAssignmentReturnsExact400AndRollsBack() throws Exception {
        // ID 1 is a known schedule-demo reference, deliberately absent from the real repository.
        var request = updateRequest(1L, "Attempted replacement title");
        request.put("note", "Attempted replacement note");
        request.put("roomId", 2L);
        request.put("location", "A102");
        request.put("startTime", "2026-11-02T09:00:00");
        request.put("endTime", "2026-11-02T11:00:00");
        assertThat(assignments.findById(1L)).isEmpty();
        assertScheduleCheckAccepts(request);

        mvc.perform(put("/api/sessions/{id}", imported.getId())
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(content().json(json.writeValueAsString(Map.of(
                        "message", "Validation failed",
                        "errors", Map.of("teachingAssignmentId", List.of("The teaching assignment no longer exists."))
                )), true));

        var persisted = sessions.findById(imported.getId()).orElseThrow();
        // Includes original imported fields, status, note, created/updated timestamps and audit actors.
        assertThat(persisted).usingRecursiveComparison().isEqualTo(imported);
        assertThat(assignments.count()).isZero();
        assertThat(sessions.count()).isEqualTo(1);
    }

    private ObjectNode updateRequest(Long assignmentId, String title) {
        var request = json.createObjectNode();
        request.put("classId", imported.getClassId());
        request.put("topicId", imported.getTopicId());
        request.put("trainerId", imported.getTrainerId());
        if (assignmentId == null) request.putNull("teachingAssignmentId");
        else request.put("teachingAssignmentId", assignmentId);
        request.put("roomId", imported.getRoomId());
        request.put("location", imported.getLocation());
        request.putNull("meetingUrl");
        request.put("title", title);
        request.put("startTime", imported.getStartTime().toString());
        request.put("endTime", imported.getEndTime().toString());
        request.put("note", imported.getNote());
        request.put("isActive", true);
        return request;
    }

    private void assertScheduleCheckAccepts(ObjectNode update) throws Exception {
        var candidate = update.deepCopy();
        candidate.put("id", imported.getId());
        candidate.remove(List.of("note", "isActive"));
        mvc.perform(post("/api/schedule-checks").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("sessions", List.of(candidate)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.issues").isEmpty());
    }
}
