package com.example.starter_project_2025.system.trainingprogram;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class LocalClassSetupIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @Test
    void localPageCanLoadAssignProgramAndManageTeachingAssignments() throws Exception {
        String login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@example.com","password":"password123"}
                                """))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String bearer = "Bearer " + mapper.readTree(login).get("accessToken").asText();

        mvc.perform(get("/api/external/data-source").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sampleData").value(true));
        mvc.perform(get("/api/external/classes").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(get("/api/external/trainers").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)));
        String seeded = mvc.perform(get("/api/classes/1/program-subjects").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.program.status").value("ACTIVE"))
                .andExpect(jsonPath("$.subjects", hasSize(3)))
                .andReturn().getResponse().getContentAsString();
        var classData = mapper.readTree(seeded);
        long programId = classData.get("program").get("id").asLong();
        long programSubjectId = classData.get("subjects").get(0).get("programSubjectId").asLong();

        mvc.perform(put("/api/classes/2/training-program").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"programId\":" + programId + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.subjects", hasSize(3)));
        String request = """
                {"classId":2,"programSubjectId":%d,"trainerId":1,"role":"MAIN",
                 "effectiveFrom":"2026-01-01","effectiveTo":null}
                """.formatted(programSubjectId);
        String created = mvc.perform(post("/api/teaching-assignments").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.trainerName").value("Giảng viên mẫu An"))
                .andReturn().getResponse().getContentAsString();
        long assignmentId = mapper.readTree(created).get("id").asLong();

        mvc.perform(post("/api/teaching-assignments").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/teaching-assignments/{id}", assignmentId).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(request.replace("\"trainerId\":1", "\"revision\":0,\"trainerId\":2")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.trainerName").value("Giảng viên mẫu Bình"));
        mvc.perform(delete("/api/teaching-assignments/{id}", assignmentId).header("Authorization", bearer))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/classes/2/teaching-assignments").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
    }
}
