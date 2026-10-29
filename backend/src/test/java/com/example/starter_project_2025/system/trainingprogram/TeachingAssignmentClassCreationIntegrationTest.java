package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.*;
import com.example.starter_project_2025.system.schedule.ScheduleReferenceProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"local", "schedule-demo"})
@Transactional
class TeachingAssignmentClassCreationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ManagedTeachingClassRepository managed;
    @Autowired ManagedTeachingTrainerRepository managedTrainers;
    @Autowired ExternalApiService external;
    @Autowired ManagedClassDirectory directory;
    @Autowired ClassTrainingProgramRepository links;
    @Autowired TrainingProgramRepository programs;
    @Autowired ScheduleReferenceProvider schedule;
    private String bearer;
    private long programId;
    private LocalDate start;

    @BeforeEach
    void prepare() throws Exception {
        start = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1);
        bearer = login("admin@example.com");
        var choices = mvc.perform(get("/api/teaching-assignments/class-program-options").header("Authorization", bearer))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        programId = mapper.readTree(choices).get(0).get("id").asLong();
    }

    @Test
    void createsArbitraryNamedClassAndLinksProgramForAssignmentAndScheduling() throws Exception {
        var json = create(request()).andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Lớp tự đặt của Thắng"))
                .andExpect(jsonPath("$.startDate").value(start.toString()))
                .andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(json).get("id").asLong();
        assertThat(id).isBetween(1L, 4_503_599_627_370_495L);
        assertThat(id).isNotIn(1L, 2L, 3L);
        assertThat(external.fetchClassById(id).getName()).isEqualTo("Lớp tự đặt của Thắng");
        assertThat(external.fetchClasses("active")).anyMatch(c -> c.getId().equals(id));
        assertThat(schedule.loadResources().classes()).anyMatch(c -> c.getId().equals(id));
        assertThat(links.findByClassId(id).orElseThrow().getProgram().getId()).isEqualTo(programId);
        var context = mvc.perform(get("/api/teaching-assignments/create-context").param("classId", String.valueOf(id))
                .header("Authorization", bearer)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long ps = mapper.readTree(context).get("subjects").get(0).get("programSubjectId").asLong();
        var assignment = mvc.perform(post("/api/teaching-assignments").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("classId", id, "programSubjectId", ps, "trainerId", 1,
                        "role", "MAIN", "effectiveFrom", start.toString(), "effectiveTo", start.plusDays(60).toString()))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long assignmentId = mapper.readTree(assignment).get("id").asLong();
        mvc.perform(post("/api/schedule-checks/scoped").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("sessions", List.of(Map.of("teachingAssignmentId", assignmentId,
                        "title", "New class session", "startTime", start.plusDays(1) + "T08:00:00", "endTime", start.plusDays(1) + "T10:00:00", "roomId", 1))))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));
    }

    @Test
    void rejectsTodayAndPastClassStartsAtTheApiWithoutCreatingAnyRecords() throws Exception {
        long classCount = managed.count(), programCount = programs.count(), linkCount = links.count();
        for (var date : List.of(start.minusDays(1), start.minusDays(2))) {
            var body = request(); body.put("startDate", date.toString());
            create(body).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.startDate[0]").value("Class start date must be tomorrow or later (Vietnam time)."));
        }
        assertThat(managed.count()).isEqualTo(classCount);
        assertThat(programs.count()).isEqualTo(programCount);
        assertThat(links.count()).isEqualTo(linkCount);
        create(request()).andExpect(status().isCreated()); // Tomorrow is the inclusive lower boundary.
    }

    @Test
    void rejectsDuplicateNormalizedNamesAndExistingSharedNamesWithoutExtraClass() throws Exception {
        create(request()).andExpect(status().isCreated());
        var duplicate = request(); duplicate.put("name", "  LỚP   TỰ ĐẶT CỦA THẮNG  ");
        create(duplicate).andExpect(status().isConflict());
        duplicate.put("name", "LOCAL_JAVA_01");
        create(duplicate).andExpect(status().isConflict());
        assertThat(managed.count()).isEqualTo(1);
    }

    @Test
    void rejectsInvalidClassDatesCountsAndInactiveProgramsBeforeSaving() throws Exception {
        for (var change : List.of(Map.<String, Object>of("name", " "), Map.<String, Object>of("programId", 999999),
                Map.<String, Object>of("startDate", start.plusDays(60).toString(), "endDate", start.toString()),
                Map.<String, Object>of("plannedSize", 0), Map.<String, Object>of("plannedSize", 10001))) {
            var body = request(); body.putAll(change); create(body).andExpect(status().isBadRequest());
        }
        var program = programs.findById(programId).orElseThrow(); program.setStatus(ProgramStatus.INACTIVE); programs.flush();
        create(request()).andExpect(status().isBadRequest());
        assertThat(managed.count()).isZero();
    }

    @Test
    void keepsManagedProfilesInDirectoryAndDetectsIdentityCollision() throws Exception {
        var json = create(request()).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(json).get("id").asLong();
        assertThat(directory.find(id)).isPresent();
        assertThat(directory.merge(List.of(), "inactive")).isEmpty();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> directory.merge(List.of(external.fetchClassById(id)), null))
                .isInstanceOf(com.example.starter_project_2025.system.external_api.exception.ExternalApiException.class);
    }

    @Test
    void deniesCreatingClassesAndReadingProgramOptionsWithoutRequiredPermissions() throws Exception {
        bearer = login("student@example.com");
        create(request()).andExpect(status().isForbidden());
        mvc.perform(get("/api/teaching-assignments/class-program-options").header("Authorization", bearer)).andExpect(status().isForbidden());
        assertThat(managed.count()).isZero();
        mvc.perform(post("/api/teaching-assignments/trainers").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("name", "New trainer", "email", "new@example.com"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void createsFreeNamedProgramAndTrainerThenSchedulesTheNewClass() throws Exception {
        long subjectId = programs.findById(programId).orElseThrow().getSubjects().get(0).getSubject().getId();
        var body = request(); body.remove("programId");
        body.put("newProgram", Map.of("name", "Chương trình Thắng tự nhập", "version", "1.0", "subjectIds", List.of(subjectId)));
        var json = create(body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long classId = mapper.readTree(json).get("id").asLong();
        var link = links.findByClassId(classId).orElseThrow();
        assertThat(link.getProgram().getName()).isEqualTo("Chương trình Thắng tự nhập");
        assertThat(link.getProgram().getStatus()).isEqualTo(ProgramStatus.ACTIVE);
        var trainerJson = saveTrainer("Giảng viên tự nhập", "trainer1.an@example.com").andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("trainer1.an@example.com")).andReturn().getResponse().getContentAsString();
        long trainerId = mapper.readTree(trainerJson).get("id").asLong();
        assertThat(external.fetchTrainers("active")).anyMatch(t -> t.getId().equals(trainerId));
        assertThat(schedule.loadResources().trainers()).anyMatch(t -> t.getId().equals(trainerId));
        long psId = link.getProgram().getSubjects().get(0).getId();
        var assignmentJson = mvc.perform(post("/api/teaching-assignments").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("classId", classId, "programSubjectId", psId, "trainerId", trainerId,
                        "role", "ASSISTANT", "effectiveFrom", start.toString(), "effectiveTo", start.plusDays(60).toString()))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long assignmentId = mapper.readTree(assignmentJson).get("id").asLong();
        mvc.perform(post("/api/schedule-checks/scoped").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("sessions", List.of(Map.of("teachingAssignmentId", assignmentId,
                        "title", "Free input flow", "startTime", start.plusDays(1) + "T08:00:00", "endTime", start.plusDays(1) + "T10:00:00", "roomId", 1))))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));
    }

    @Test
    void invalidNewProgramRollsBackClassAndProgramTogether() throws Exception {
        long before = programs.count();
        var body = request(); body.remove("programId");
        for (var ids : List.of(List.<Long>of(), List.of(999999L), List.of(1L, 1L))) {
            body.put("newProgram", Map.of("name", "New program", "version", "1.0", "subjectIds", ids));
            create(body).andExpect(status().isBadRequest());
        }
        assertThat(managed.count()).isZero();
        assertThat(programs.count()).isEqualTo(before);
    }

    @Test
    void freeEmailCreatesTrainerAndRepeatedIdenticalProfileReusesItsIdentity() throws Exception {
        var result = saveTrainer("Trainer freely entered", "fresh.trainer@example.com").andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(result).get("id").asLong();
        saveTrainer("  Trainer   freely entered  ", "FRESH.TRAINER@example.com").andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        saveTrainer("Another trainer", "fresh.trainer@example.com").andExpect(status().isConflict());
        saveTrainer("Bad email", "not-an-email").andExpect(status().isBadRequest());
        saveTrainer("", "valid@example.com").andExpect(status().isBadRequest());
        assertThat(managedTrainers.count()).isEqualTo(1);
    }

    private ResultActions saveTrainer(String name, String email) throws Exception {
        return mvc.perform(post("/api/teaching-assignments/trainers").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("name", name, "email", email))));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentRequestsCannotCreateTwoClassesWithTheSameName() throws Exception {
        var gate = new java.util.concurrent.CountDownLatch(1);
        var createdIds = new java.util.ArrayList<Long>();
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var tasks = new java.util.ArrayList<java.util.concurrent.Future<org.springframework.mock.web.MockHttpServletResponse>>();
            for (int index = 0; index < 2; index++) tasks.add(pool.submit(() -> {
                gate.await();
                return create(request()).andReturn().getResponse();
            }));
            gate.countDown();
            var statuses = new java.util.ArrayList<Integer>();
            for (var task : tasks) {
                var response = task.get(20, java.util.concurrent.TimeUnit.SECONDS);
                statuses.add(response.getStatus());
                if (response.getStatus() == 201) createdIds.add(mapper.readTree(response.getContentAsString()).get("id").asLong());
            }
            assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        } finally {
            gate.countDown();
            for (long id : createdIds) {
                links.findByClassId(id).ifPresent(links::delete);
                managed.findByReferenceId(id).ifPresent(managed::delete);
            }
        }
    }

    private Map<String, Object> request() {
        return new HashMap<>(Map.of("name", "Lớp tự đặt của Thắng", "programId", programId,
                "startDate", start.toString(), "endDate", start.plusDays(60).toString(), "plannedSize", 25));
    }
    private ResultActions create(Map<String, Object> body) throws Exception {
        return mvc.perform(post("/api/teaching-assignments/classes").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }
    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("email", email, "password", "password123")))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + mapper.readTree(body).get("accessToken").asText();
    }
}
