package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

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
class TeachingAssignmentCreateIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ProgramSubjectRepository programSubjects;
    @Autowired TrainingProgramRepository programs;
    @SpyBean ExternalApiService external;
    private String bearer;
    private long programSubjectId;

    @BeforeEach
    void setUp() throws Exception {
        bearer = login("admin@example.com");
        var classProfile = external.fetchClassById(1L);
        classProfile.setStartDate("2026-01-01");
        classProfile.setEndDate("2026-12-31");
        doReturn(classProfile).when(external).fetchClassById(1L);
        var body = mvc.perform(get("/api/classes/1/program-subjects").header("Authorization", bearer))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        programSubjectId = mapper.readTree(body).get("subjects").get(0).get("programSubjectId").asLong();
    }

    @Test
    void offersOnlyConfiguredActiveClassesAndActiveTrainerProfiles() throws Exception {
        mvc.perform(get("/api/teaching-assignments/create-options").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.classes", hasSize(1)))
                .andExpect(jsonPath("$.classes[0].id").value(1)).andExpect(jsonPath("$.trainers", hasSize(2)));
        mvc.perform(get("/api/teaching-assignments/create-context").param("classId", "1").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.subjects", hasSize(3)))
                .andExpect(jsonPath("$.classProfile.startDate").value("2026-01-01"))
                .andExpect(jsonPath("$.program.status").value("ACTIVE"));
    }

    @Test
    void createsAnAssignmentAndMakesItAvailableAtBothDateBoundaries() throws Exception {
        create(request()).andExpect(status().isCreated())
                .andExpect(jsonPath("$.effectiveFrom").value("2026-01-01"))
                .andExpect(jsonPath("$.effectiveTo").value("2026-12-31"));
        for (String date : List.of("2026-01-01", "2026-12-31")) {
            mvc.perform(get("/api/classes/1/teaching-assignments/available").param("date", date).header("Authorization", bearer))
                    .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].programSubjectId").value(programSubjectId));
        }
    }

    @Test
    void boundsOmittedEndToClassEndAndAllowsSameDayPeriods() throws Exception {
        var open = request();
        open.remove("effectiveTo");
        create(open).andExpect(status().isCreated()).andExpect(jsonPath("$.effectiveTo").value("2026-12-31"));
        var sameDay = request();
        sameDay.put("role", "ASSISTANT");
        sameDay.put("trainerId", 2);
        sameDay.put("effectiveTo", "2026-01-01");
        create(sameDay).andExpect(status().isCreated());
    }

    @Test
    void rejectsMissingAndInvalidIdsAndMalformedJsonValues() throws Exception {
        for (String field : List.of("classId", "programSubjectId", "trainerId", "role", "effectiveFrom")) {
            var missing = request();
            missing.remove(field);
            create(missing).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors." + field).isArray());
        }
        for (String field : List.of("classId", "programSubjectId", "trainerId")) {
            var invalid = request();
            invalid.put(field, -1);
            create(invalid).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors." + field).isArray());
        }
        for (Map<String, Object> invalid : List.of(Map.<String, Object>of("role", "OWNER"), Map.<String, Object>of("effectiveFrom", "not-a-date"))) {
            var body = request();
            body.putAll(invalid);
            create(body).andExpect(status().isBadRequest());
        }
        assertThat(assignments.count()).isZero();
    }

    @Test
    void rejectsReversedAndOutOfClassDatesWithFieldErrors() throws Exception {
        for (String[] values : new String[][]{
                {"2025-12-31", "2026-02-01", "effectiveFrom"},
                {"2027-01-01", "2027-01-02", "effectiveFrom"},
                {"2026-02-01", "2026-01-31", "effectiveTo"},
                {"2026-01-01", "2027-01-01", "effectiveTo"}}) {
            var body = request();
            body.put("effectiveFrom", values[0]);
            body.put("effectiveTo", values[1]);
            create(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors." + values[2]).isArray());
        }
        assertThat(assignments.count()).isZero();
    }

    @Test
    void rejectsUnconfiguredOrInactiveClassAndUnknownTrainer() throws Exception {
        for (int classId : List.of(2, 3)) {
            var body = request();
            body.put("classId", classId);
            create(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.classId").isArray());
        }
        for (int trainerId : List.of(3, 99999)) {
            var body = request();
            body.put("trainerId", trainerId);
            create(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.trainerId").isArray());
        }
        assertThat(assignments.count()).isZero();
    }

    @Test
    void rejectsForeignProgramSubjectAndInactiveProgram() throws Exception {
        var original = programSubjects.findById(programSubjectId).orElseThrow();
        var foreignProgram = new TrainingProgram();
        foreignProgram.setCode("OTHER_PROGRAM");
        foreignProgram.setName("Other program");
        foreignProgram.setVersion("1.0");
        foreignProgram.setStatus(ProgramStatus.ACTIVE);
        programs.saveAndFlush(foreignProgram);
        var foreignSubject = new ProgramSubject();
        foreignSubject.setProgram(foreignProgram);
        foreignSubject.setSubject(original.getSubject());
        foreignSubject.setOrderIndex(1);
        programSubjects.saveAndFlush(foreignSubject);
        var body = request();
        body.put("programSubjectId", foreignSubject.getId());
        create(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.programSubjectId").isArray());
        original.getProgram().setStatus(ProgramStatus.INACTIVE);
        programs.flush();
        create(request()).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.classId").isArray());
        mvc.perform(get("/api/teaching-assignments/create-options").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.classes", hasSize(0)));
    }

    @Test
    void excludesDraftSubjectsAndRechecksSubjectAndTrainerStatusOnSave() throws Exception {
        var subject = programSubjects.findById(programSubjectId).orElseThrow().getSubject();
        subject.setStatus(SubjectStatus.DRAFT);
        programSubjects.flush();
        mvc.perform(get("/api/teaching-assignments/create-context").param("classId", "1").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.subjects", hasSize(2)));
        create(request()).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.programSubjectId").isArray());
        subject.setStatus(SubjectStatus.ACTIVE);
        doReturn(List.of(new ExternalTrainerDTO(1L, "Inactive trainer", "old@example.com", "inactive")))
                .when(external).fetchTrainers("active");
        create(request()).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.trainerId").isArray());
    }

    @Test
    void enforcesMainAndTrainerOverlapButAllowsAdjacentDates() throws Exception {
        var main = request();
        main.put("effectiveTo", "2026-01-10");
        create(main).andExpect(status().isCreated());
        create(main).andExpect(status().isConflict());
        var second = request();
        second.put("trainerId", 2);
        second.put("effectiveFrom", "2026-01-10");
        create(second).andExpect(status().isConflict());
        var sameTrainer = request();
        sameTrainer.put("role", "ASSISTANT");
        create(sameTrainer).andExpect(status().isConflict());
        second.put("effectiveFrom", "2026-01-11");
        create(second).andExpect(status().isCreated());
    }

    @Test
    void allowsMultipleDifferentAssistantTrainers() throws Exception {
        var assistant = request();
        assistant.put("role", "ASSISTANT");
        create(assistant).andExpect(status().isCreated());
        assistant.put("trainerId", 2);
        create(assistant).andExpect(status().isCreated());
        assertThat(assignments.count()).isEqualTo(2);
    }

    @Test
    void failsWithoutWritingWhenSharedTrainerServiceIsUnavailable() throws Exception {
        doThrow(new ExternalApiException("Trainer service unavailable", 503, null)).when(external).fetchTrainers("active");
        create(request()).andExpect(status().isServiceUnavailable());
        assertThat(assignments.count()).isZero();
    }

    @Test
    void invalidSharedClassDatesAreReportedAsUpstreamErrors() throws Exception {
        var classProfile = external.fetchClassById(1L);
        classProfile.setStartDate("invalid");
        mvc.perform(get("/api/teaching-assignments/create-context").param("classId", "1").header("Authorization", bearer))
                .andExpect(status().isBadGateway());
        create(request()).andExpect(status().isBadGateway());
        classProfile.setStartDate("2027-01-01");
        create(request()).andExpect(status().isBadGateway());
        assertThat(assignments.count()).isZero();
    }

    @Test
    void requiresCreatePermissionForOptionsContextAndPost() throws Exception {
        String student = login("student@example.com");
        for (String path : List.of("/api/teaching-assignments/create-options", "/api/teaching-assignments/create-context?classId=1")) {
            mvc.perform(get(path).header("Authorization", student)).andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/teaching-assignments").header("Authorization", student).contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request()))).andExpect(status().isForbidden());
        assertThat(assignments.count()).isZero();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentMainAssignmentsCannotBothSucceed() throws Exception {
        var gate = new CountDownLatch(1);
        var ready = new CountDownLatch(2);
        var createdIds = new ArrayList<Long>();
        try (var executor = Executors.newFixedThreadPool(2)) {
            var futures = new ArrayList<java.util.concurrent.Future<org.springframework.mock.web.MockHttpServletResponse>>();
            for (int trainerId : List.of(1, 2)) {
                futures.add(executor.submit(() -> {
                    var body = request();
                    body.put("trainerId", trainerId);
                    body.put("effectiveFrom", "2026-07-01");
                    ready.countDown();
                    if (!gate.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent start timed out");
                    return create(body).andReturn().getResponse();
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            gate.countDown();
            var statuses = new ArrayList<Integer>();
            for (var future : futures) {
                var response = future.get(20, TimeUnit.SECONDS);
                statuses.add(response.getStatus());
                if (response.getStatus() == 201) createdIds.add(mapper.readTree(response.getContentAsString()).get("id").asLong());
            }
            assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        } finally {
            gate.countDown();
            assignments.deleteAllById(createdIds);
        }
    }

    private Map<String, Object> request() {
        return new java.util.HashMap<>(Map.of("classId", 1, "programSubjectId", programSubjectId, "trainerId", 1,
                "role", "MAIN", "effectiveFrom", "2026-01-01", "effectiveTo", "2026-12-31"));
    }

    private ResultActions create(Map<String, Object> request) throws Exception {
        return mvc.perform(post("/api/teaching-assignments").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)));
    }

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + mapper.readTree(body).get("accessToken").asText();
    }
}
