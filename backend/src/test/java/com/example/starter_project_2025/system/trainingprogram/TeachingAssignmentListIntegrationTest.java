package com.example.starter_project_2025.system.trainingprogram;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import com.example.starter_project_2025.system.menu.module.ModuleRepository;

import java.time.LocalDate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class TeachingAssignmentListIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ClassTrainingProgramRepository classPrograms;
    @Autowired ModuleRepository modules;
    private String bearer;
    private Long subjectId;

    @BeforeEach
    void setUp() throws Exception {
        bearer = login("admin@example.com");
        var subjects = classPrograms.findByClassId(1L).orElseThrow().getProgram().getSubjects();
        var first = subjects.stream().filter(s -> s.getSubject().getCode().equals("JAVA_CORE")).findFirst().orElseThrow();
        var second = subjects.stream().filter(s -> s.getSubject().getCode().equals("DATABASE_SQL")).findFirst().orElseThrow();
        subjectId = first.getSubject().getId();
        seed(1L, first, 1L, AssignmentRole.MAIN, "2026-01-01", "2026-01-31");
        seed(1L, second, 2L, AssignmentRole.ASSISTANT, "2026-01-01", null);
        // Historical profiles remain searchable even when no longer active.
        seed(3L, first, 3L, AssignmentRole.MAIN, "2025-01-01", "2025-12-31");
        assignments.flush();
    }

    @Test
    void searchesSubjectClassAndTrainerAndTreatsWildcardsLiterally() throws Exception {
        expectCount("JAVA_CORE", 2);
        expectCount("local_java_01", 2);
        expectCount("TRAINER.BINH@EXAMPLE.COM", 1);
        expectCount("%", 0);
        expectCount("not-a-match", 0);
    }

    @Test
    void combinesFiltersAndIncludesBothEffectiveDateBoundaries() throws Exception {
        for (String day : new String[]{"2026-01-01", "2026-01-31"}) {
            mvc.perform(get("/api/teaching-assignments").header("Authorization", bearer)
                            .param("classId", "1").param("subjectId", subjectId.toString())
                            .param("trainerId", "1").param("role", "MAIN").param("effectiveOn", day))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.content[0].subjectCode").value("JAVA_CORE"));
        }
        mvc.perform(get("/api/teaching-assignments").header("Authorization", bearer)
                        .param("effectiveOn", "2026-02-01"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].role").value("ASSISTANT"));
        mvc.perform(get("/api/teaching-assignments").header("Authorization", bearer)
                        .param("classId", "1").param("trainerId", "3"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void pagesStablyAndRejectsUnsupportedSortOrOversizedRequests() throws Exception {
        long[] ids = new long[3];
        for (int page = 0; page < 3; page++) {
            var body = mvc.perform(get("/api/teaching-assignments").header("Authorization", bearer)
                            .param("page", String.valueOf(page)).param("size", "1").param("sort", "effectiveFrom,asc"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.totalElements").value(3)).andExpect(jsonPath("$.totalPages").value(3))
                    .andReturn().getResponse().getContentAsString();
            ids[page] = mapper.readTree(body).get("content").get(0).get("id").asLong();
        }
        assertThat(ids).doesNotHaveDuplicates();
        mvc.perform(get("/api/teaching-assignments").header("Authorization", bearer).param("page", "10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(3));
        for (String[] invalid : new String[][]{{"sort", "unknown,asc"}, {"size", "101"}, {"search", "a".repeat(101)}}) {
            mvc.perform(get("/api/teaching-assignments").header("Authorization", bearer).param(invalid[0], invalid[1]))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void exposesHistoricalFilterOptionsAndRegistersTheMenu() throws Exception {
        mvc.perform(get("/api/teaching-assignments/options").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.classes", hasSize(3)))
                .andExpect(jsonPath("$.trainers", hasSize(3))).andExpect(jsonPath("$.subjects", hasSize(2)))
                .andExpect(jsonPath("$.sampleData").value(true));
        var menu = modules.findByUrl("/teaching-assignments").orElseThrow();
        assertThat(menu.getTitle()).isEqualTo("Teaching Assignments");
        assertThat(menu.getRequiredPermission()).isEqualTo("ASSIGNMENT_READ");
        assertThat(menu.getModuleGroup().getName()).isEqualTo("Training Operations");
    }

    @Test
    void deniesListAndOptionsWithoutAssignmentReadPermission() throws Exception {
        String student = login("student@example.com");
        for (String path : new String[]{"/api/teaching-assignments", "/api/teaching-assignments/options"}) {
            mvc.perform(get(path).header("Authorization", student)).andExpect(status().isForbidden());
        }
    }

    private void expectCount(String search, int count) throws Exception {
        mvc.perform(get("/api/teaching-assignments").header("Authorization", bearer).param("search", search))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(count));
    }

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(java.util.Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + mapper.readTree(body).get("accessToken").asText();
    }

    private void seed(Long classId, ProgramSubject subject, Long trainer, AssignmentRole role, String from, String to) {
        var assignment = new TeachingAssignment();
        assignment.setClassId(classId);
        assignment.setProgramSubject(subject);
        assignment.setTrainerId(trainer);
        assignment.setRole(role);
        assignment.setEffectiveFrom(LocalDate.parse(from));
        assignment.setEffectiveTo(to == null ? null : LocalDate.parse(to));
        assignments.save(assignment);
    }
}
