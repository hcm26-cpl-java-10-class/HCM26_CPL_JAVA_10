package com.example.starter_project_2025.system.project.milestone;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository;
import com.example.starter_project_2025.system.project.milestone.idempotency.IdempotencyRepository;
import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventRepository;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneChecklistItemRepository;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class MilestoneIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired RefreshTokenService tokenService;
    @Autowired org.springframework.security.core.userdetails.UserDetailsService userDetailsService;
    @Autowired MilestoneRepository milestoneRepository;
    @Autowired MilestoneChecklistItemRepository checklistRepository;
    @Autowired MilestoneAuditRepository auditRepository;
    @Autowired OutboxEventRepository outboxRepository;
    @Autowired IdempotencyRepository idempotencyRepository;

    private String teacherToken;

    @BeforeEach
    void setUp() {
        idempotencyRepository.deleteAll();
        outboxRepository.deleteAll();
        auditRepository.deleteAll();
        checklistRepository.deleteAll();
        milestoneRepository.deleteAll();
        var teacher = userDetailsService.loadUserByUsername("teacher@example.com");
        teacherToken = tokenService.generateAccessToken(
                new UsernamePasswordAuthenticationToken(teacher, null, teacher.getAuthorities()));
    }

    @Test
    void createsAndReplaysExactlyOneMilestoneAggregate() throws Exception {
        Map<String, Object> body = validRequest();
        String key = "create-milestone-integration-1";

        String firstResponse = mockMvc.perform(post(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(header().exists("X-Correlation-ID"))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.checklist.length()").value(2))
                .andReturn().getResponse().getContentAsString();

        mockMvc.perform(post(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(content().json(firstResponse));

        org.junit.jupiter.api.Assertions.assertEquals(1, milestoneRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(2, checklistRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(1, auditRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(1, outboxRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(1, idempotencyRepository.count());
    }

    @Test
    void rejectsSameKeyWithDifferentPayload() throws Exception {
        Map<String, Object> body = validRequest();
        String key = "create-milestone-integration-2";
        mockMvc.perform(post(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated());

        body.put("title", "Different title");
        mockMvc.perform(post(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void rejectsPastDeadlineWithFieldErrorAndDoesNotPersist() throws Exception {
        Map<String, Object> body = validRequest();
        body.put("deadline", Instant.now().minusSeconds(1).toString());

        mockMvc.perform(post(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .header("Idempotency-Key", "create-milestone-invalid-deadline")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.deadline").isArray())
                .andExpect(jsonPath("$.correlationId").isNotEmpty());

        org.junit.jupiter.api.Assertions.assertEquals(0, milestoneRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(0, checklistRepository.count());
    }

    @Test
    void concurrentRequestsWithSameKeyCreateOnlyOneAggregate() throws Exception {
        String payload = objectMapper.writeValueAsString(validRequest());
        String key = "create-milestone-concurrent";
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var request = (java.util.concurrent.Callable<Integer>) () -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post(endpoint())
                                .header("Authorization", "Bearer " + teacherToken)
                                .header("Idempotency-Key", key)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                        .andReturn().getResponse().getStatus();
            };

            var first = executor.submit(request);
            var second = executor.submit(request);
            org.junit.jupiter.api.Assertions.assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            org.junit.jupiter.api.Assertions.assertEquals(201, first.get(20, TimeUnit.SECONDS));
            org.junit.jupiter.api.Assertions.assertEquals(201, second.get(20, TimeUnit.SECONDS));
        }

        org.junit.jupiter.api.Assertions.assertEquals(1, milestoneRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(2, checklistRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(1, auditRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(1, outboxRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(1, idempotencyRepository.count());
    }

    private String endpoint() {
        return "/api/projects/" + MockMilestoneData.PROJECT_ID + "/milestones";
    }

    private Map<String, Object> validRequest() {
        Instant deadline = Instant.now().plusSeconds(86400);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "Sprint 1 Delivery");
        body.put("description", "First milestone");
        body.put("deadline", deadline.toString());
        body.put("mandatory", true);
        body.put("checklist", List.of(
                Map.of("content", "Source code is pushed", "mandatory", true, "orderIndex", 0),
                Map.of("content", "Demo is ready", "mandatory", true, "orderIndex", 1)
        ));
        body.put("rubricSnapshotId", MockMilestoneData.RUBRIC_ID.toString());
        body.put("reviewerId", MockMilestoneData.REVIEWER_ID.toString());
        body.put("latePolicy", Map.of(
                "type", "ALLOW_LATE",
                "lateUntil", deadline.plusSeconds(7200).toString(),
                "penaltyPercent", 10.00
        ));
        return body;
    }
}
