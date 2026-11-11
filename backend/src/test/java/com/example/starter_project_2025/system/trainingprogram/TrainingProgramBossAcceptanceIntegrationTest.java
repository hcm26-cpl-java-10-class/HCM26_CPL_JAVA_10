
package com.example.starter_project_2025.system.trainingprogram;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class TrainingProgramBossAcceptanceIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    private String adminToken() throws Exception {
        String login = mvc.perform(
                        post("/api/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "email": "admin@example.com",
                                          "password": "password123"
                                        }
                                        """)
                )
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return "Bearer " + mapper.readTree(login)
                .get("accessToken")
                .asText();
    }

    @Test
    void cloneCreatesNewVersionButExistingClassKeepsItsOriginalProgramId()
            throws Exception {

        String token = adminToken();

        String classJson = mvc.perform(
                        get("/api/classes/1/program-subjects")
                                .header("Authorization", token)
                )
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode originalClass = mapper.readTree(classJson);

        long originalProgramId = originalClass
                .path("program")
                .path("id")
                .asLong();

        int originalSubjectCount = originalClass
                .path("subjects")
                .size();

        String clonedJson = mvc.perform(
                        post("/api/programs/{id}/clone", originalProgramId)
                                .param(
                                        "newVersion",
                                        "BOSS-TEST-" + System.nanoTime()
                                )
                                .header("Authorization", token)
                )
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode cloned = mapper.readTree(clonedJson);

        long clonedId = cloned.path("id").asLong();

        org.junit.jupiter.api.Assertions.assertNotEquals(
                originalProgramId,
                clonedId
        );

        org.junit.jupiter.api.Assertions.assertEquals(
                originalSubjectCount,
                cloned.path("subjects").size()
        );

        mvc.perform(
                        get("/api/classes/1/program-subjects")
                                .header("Authorization", token)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.program.id").value(originalProgramId));

        mvc.perform(
                        delete("/api/programs/{id}", originalProgramId)
                                .header("Authorization", token)
                )
                .andExpect(status().isConflict());
    }

    @Test
    void programListReturnsServerPageMetadataAndAcceptsCombinedFilters()
            throws Exception {

        String token = adminToken();

        mvc.perform(
                        get("/api/programs")
                                .param("page", "0")
                                .param("size", "1")
                                .param("sort", "code,asc")
                                .param("status", "ACTIVE")
                                .header("Authorization", token)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath(
                        "$.totalElements",
                        greaterThanOrEqualTo(0)
                ));
    }
}
