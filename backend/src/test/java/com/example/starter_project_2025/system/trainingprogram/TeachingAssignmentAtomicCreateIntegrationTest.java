package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:atomic_assignment;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE")
@AutoConfigureMockMvc
@ActiveProfiles({"local", "schedule-demo"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class TeachingAssignmentAtomicCreateIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ManagedTeachingClassRepository classes;
    @Autowired ManagedTeachingTrainerRepository trainers;
    @Autowired TrainingProgramRepository programs;
    @Autowired ProgramSubjectRepository subjects;
    @Autowired com.example.starter_project_2025.system.subject.SubjectRepository catalog;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ClassTrainingProgramRepository links;
    private String bearer;
    private long subjectId;

    @BeforeEach
    void prepare() throws Exception {
        assignments.deleteAll();
        var ids = classes.findAll().stream().map(ManagedTeachingClass::getReferenceId).toList();
        var ownedLinks = links.findAll().stream().filter(link -> ids.contains(link.getClassId())).toList();
        var ownedProgramIds = ownedLinks.stream().map(link -> link.getProgram().getId()).toList();
        ownedLinks.forEach(links::delete);
        classes.deleteAll(); trainers.deleteAll();
        programs.findAll().stream().filter(p -> p.getName().equals("Atomic program") || ownedProgramIds.contains(p.getId())).forEach(programs::delete);
        catalog.findAll().stream().filter(s -> s.getCode().startsWith("SUB_")).forEach(catalog::delete);
        bearer = login("admin@example.com");
        var response = mvc.perform(get("/api/teaching-assignments/class-subject-options").header("Authorization", bearer))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        subjectId = json.readTree(response).get(0).get("id").asLong();
    }

    @Test
    void savesAllDetailsWithOneRequestAndMapsSubjectToTheNewCurriculum() throws Exception {
        var before = counts();
        create(body()).andExpect(status().isCreated()).andExpect(jsonPath("$.subjectId").value(subjectId))
                .andExpect(jsonPath("$.trainerName").value("Atomic trainer"))
                .andExpect(jsonPath("$.className").value("Atomic class"))
                .andExpect(jsonPath("$.programName").value("Atomic program"));
        assertThat(counts()).containsExactly(before.get(0) + 1, before.get(1) + 1, before.get(2) + 1,
                before.get(3) + 1, before.get(4) + 1, before.get(5) + 1, before.get(6));
    }

    @Test
    void assignmentDateFailureRollsBackProgramClassTrainerAndLinks() throws Exception {
        var before = counts();
        var request = body(); request.put("effectiveFrom", "2026-10-01");
        create(request).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.effectiveFrom").isArray());
        assertThat(counts()).isEqualTo(before);
    }

    @Test
    void invalidAssignmentSubjectRollsBackEveryNewRecord() throws Exception {
        var before = counts();
        var request = body(); request.put("subjectId", 999999);
        create(request).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.subjectId").isArray());
        assertThat(counts()).isEqualTo(before);
    }

    @Test
    void trainerConflictDoesNotLeaveClassOrProgramBehind() throws Exception {
        var before = counts();
        var request = body(); request.put("trainer", Map.of("name", "Different owner", "email", "trainer.an@example.com"));
        create(request).andExpect(status().isConflict());
        assertThat(counts()).isEqualTo(before);
    }

    @Test
    void validationAndAuthorizationRejectBeforeWriting() throws Exception {
        var before = counts();
        for (String key : List.of("classDetails", "trainer", "subjectId", "role", "effectiveFrom")) {
            var missing = body(); missing.remove(key); create(missing).andExpect(status().isBadRequest());
        }
        var malformed = body(); malformed.put("role", "OWNER"); create(malformed).andExpect(status().isBadRequest());
        bearer = login("student@example.com");
        create(body()).andExpect(status().isForbidden());
        assertThat(counts()).isEqualTo(before);
    }

    @Test
    void repeatedSubmissionDoesNotDuplicatePreviouslyCommittedDetails() throws Exception {
        create(body()).andExpect(status().isCreated());
        var committed = counts();
        create(body()).andExpect(status().isConflict());
        assertThat(counts()).isEqualTo(committed);
    }

    @Test
    void reusesExistingTrainerAndBoundsMissingEndToTheNewClassEnd() throws Exception {
        var before = counts();
        var request = body(); request.remove("effectiveTo");
        request.put("trainer", Map.of("name", "Giảng viên mẫu An", "email", "trainer.an@example.com"));
        create(request).andExpect(status().isCreated()).andExpect(jsonPath("$.trainerId").value(1))
                .andExpect(jsonPath("$.effectiveTo").value("2026-12-31"));
        assertThat(trainers.count()).isEqualTo(before.get(2));
    }

    @Test
    void createsFreeNamedSubjectWithoutAnyExistingSubjectMatch() throws Exception {
        var before = counts();
        var request = freeSubjectBody("Java name freely entered", 40);
        var response = create(request).andExpect(status().isCreated()).andExpect(jsonPath("$.subjectName").value("Java name freely entered"))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(response).get("subjectId").asLong();
        var saved = catalog.findById(id).orElseThrow();
        assertThat(saved.getDurationHours()).isEqualTo(40);
        assertThat(saved.getStatus()).isEqualTo(com.example.starter_project_2025.system.subject.SubjectStatus.ACTIVE);
        assertThat(saved.getIsActive()).isTrue();
        assertThat(counts()).containsExactly(before.get(0) + 1, before.get(1) + 1, before.get(2) + 1,
                before.get(3) + 1, before.get(4) + 1, before.get(5) + 1, before.get(6) + 1);
    }

    @Test
    void enforcesSubjectNameLengthAndDurationAtTheApiBoundary() throws Exception {
        var before = counts();
        for (String name : List.of("", "  ", "x".repeat(201))) create(freeSubjectBody(name, 40)).andExpect(status().isBadRequest());
        for (int hours : List.of(0, -1)) create(freeSubjectBody("New subject", hours)).andExpect(status().isBadRequest());
        assertThat(counts()).isEqualTo(before);
        create(freeSubjectBody("x".repeat(200), 1)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.subjectName").value("x".repeat(200)));
    }

    @Test
    void laterAssignmentFailureAlsoRollsBackTheNewSubject() throws Exception {
        var before = counts();
        var request = freeSubjectBody("Should not be left behind", 40);
        request.put("effectiveFrom", "2026-10-01");
        create(request).andExpect(status().isBadRequest());
        assertThat(counts()).isEqualTo(before);
    }

    private Map<String, Object> freeSubjectBody(String name, int hours) {
        var request = body();
        request.remove("subjectId");
        request.put("newSubject", Map.of("name", name, "durationHours", hours));
        request.put("classDetails", Map.of("name", "Atomic class", "startDate", "2026-11-01", "endDate", "2026-12-31", "plannedSize", 25,
                "newProgram", Map.of("name", "Atomic program", "version", "1.0", "subjectIds", List.of())));
        return request;
    }

    @Test
    void allEditableTextFieldsEnforce200CharactersAndSearchUsesTheSameLimit() throws Exception {
        String email = "a".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(7);
        assertThat(email).hasSize(200);
        var request = freeSubjectBody("S".repeat(200), 40);
        request.put("classDetails", Map.of("name", "C".repeat(200), "startDate", "2026-11-01", "endDate", "2026-12-31", "plannedSize", 25,
                "newProgram", Map.of("name", "P".repeat(200), "version", "1.0", "subjectIds", List.of())));
        request.put("trainer", Map.of("name", "T".repeat(200), "email", email));
        var before = counts();
        for (String path : List.of("classDetails.name", "classDetails.newProgram.name", "trainer.name", "trainer.email", "newSubject.name")) {
            var invalid = json.valueToTree(request);
            var keys = path.split("\\.");
            var parent = invalid;
            for (int index = 0; index < keys.length - 1; index++) parent = parent.get(keys[index]);
            ((com.fasterxml.jackson.databind.node.ObjectNode) parent).put(keys[keys.length - 1], path.equals("trainer.email") ? email + "d" : "x".repeat(201));
            mvc.perform(post("/api/teaching-assignments/create-with-details").header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON).content(invalid.toString())).andExpect(status().isBadRequest());
        }
        assertThat(counts()).isEqualTo(before);
        create(request).andExpect(status().isCreated()).andExpect(jsonPath("$.className").value("C".repeat(200)))
                .andExpect(jsonPath("$.programName").value("P".repeat(200)))
                .andExpect(jsonPath("$.trainerName").value("T".repeat(200)))
                .andExpect(jsonPath("$.subjectName").value("S".repeat(200)));
        mvc.perform(get("/api/teaching-assignments").header("Authorization", bearer).param("search", "C".repeat(200)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/teaching-assignments").header("Authorization", bearer).param("search", "C".repeat(201)))
                .andExpect(status().isBadRequest());
    }

    private List<Long> counts() {
        return List.of(classes.count(), programs.count(), trainers.count(), assignments.count(), links.count(), subjects.count(), catalog.count());
    }
    private Map<String, Object> body() {
        return new HashMap<>(Map.of("classDetails", Map.of("name", "Atomic class", "startDate", "2026-11-01", "endDate", "2026-12-31", "plannedSize", 25,
                        "newProgram", Map.of("name", "Atomic program", "version", "1.0", "subjectIds", List.of(subjectId))),
                "trainer", Map.of("name", "Atomic trainer", "email", "atomic.trainer@example.com"), "subjectId", subjectId,
                "role", "MAIN", "effectiveFrom", "2026-11-02", "effectiveTo", "2026-11-30"));
    }
    private ResultActions create(Map<String, Object> body) throws Exception {
        return mvc.perform(post("/api/teaching-assignments/create-with-details").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
    private String login(String email) throws Exception {
        var response = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(response).get("accessToken").asText();
    }
}
