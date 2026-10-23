package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditRepository;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxRepository;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxService;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxStatus;
import com.example.starter_project_2025.system.project.task.tag.TagRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.AopTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:task_integration;DB_CLOSE_DELAY=-1",
        "app.sprint.outbox.initial-delay-ms=3600000"
})
@AutoConfigureMockMvc
class TaskIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired TaskRepository taskRepository;
    @Autowired TagRepository tagRepository;
    @Autowired TaskAuditRepository auditRepository;
    @Autowired TaskOutboxRepository outboxRepository;
    @Autowired UserRepository userRepository;
    @Autowired UserDetailsService userDetailsService;
    @Autowired RefreshTokenService tokenService;
    @Autowired TransactionTemplate transactionTemplate;
    @MockBean TaskProjectAccess projectAccess;
    @SpyBean TaskOutboxService outboxService;

    private UUID projectId;
    private UUID otherProjectId;
    private UUID assigneeMemberId;
    private Long studentId;
    private Long teacherId;
    private String studentToken;
    private String teacherToken;
    private TaskOutboxService outboxSpy;

    @BeforeEach
    void setUp() {
        taskRepository.deleteAll();
        auditRepository.deleteAll();
        outboxRepository.deleteAll();
        tagRepository.deleteAll();
        projectId = UUID.randomUUID();
        otherProjectId = UUID.randomUUID();
        assigneeMemberId = UUID.randomUUID();
        studentId = userRepository.findByEmail("student@example.com").orElseThrow().getId();
        teacherId = userRepository.findByEmail("teacher@example.com").orElseThrow().getId();
        studentToken = token("student@example.com");
        teacherToken = token("teacher@example.com");
        outboxSpy = AopTestUtils.getUltimateTargetObject(outboxService);
        when(projectAccess.findProjectIds(anyLong())).thenReturn(Set.of(projectId, otherProjectId));
        when(projectAccess.findMemberUserId(any(), any())).thenReturn(Optional.empty());
        when(projectAccess.findMemberUserId(projectId, assigneeMemberId)).thenReturn(Optional.of(studentId));
    }

    @Test
    void createUsesErdFieldsAndStoresAuditOutboxAndNormalizedTags() throws Exception {
        TaskDTO request = request();
        request.setTitle("  Viết API đăng nhập  ");
        request.setDescription("Đăng nhập bằng email");
        request.setSprintId(UUID.randomUUID());
        request.setMilestoneId(UUID.randomUUID());
        request.setAssigneeProjectMemberId(assigneeMemberId);
        request.setEstimatedHours(1.5);
        request.setPriority(TaskPriority.HIGH);
        request.setTags(List.of(" Backend ", "backend", "API"));
        request.setCreatedBy(9999L);
        request.setId(UUID.randomUUID());
        UUID requestId = UUID.randomUUID();

        JsonNode created = create(request, studentToken, requestId);
        UUID id = UUID.fromString(created.get("id").asText());
        assertNotEquals(request.getId(), id);
        assertEquals("Viết API đăng nhập", created.get("title").asText());
        assertEquals(projectId.toString(), created.get("projectId").asText());
        assertEquals(assigneeMemberId.toString(), created.get("assigneeProjectMemberId").asText());
        assertEquals(request.getSprintId().toString(), created.get("sprintId").asText());
        assertEquals(request.getMilestoneId().toString(), created.get("milestoneId").asText());
        assertEquals(1.5, created.get("estimatedHours").asDouble());
        assertEquals("TODO", created.get("status").asText());
        assertEquals("HIGH", created.get("priority").asText());
        assertEquals(studentId, created.get("createdBy").asLong());
        assertEquals(2, created.get("tags").size());
        assertNotNull(created.get("createdAt"));
        assertEquals(0, created.get("version").asLong());

        var audit = auditRepository.findByTaskIdOrderByOccurredAtAsc(id).getFirst();
        assertEquals(studentId, audit.getActorId());
        assertEquals("CREATE", audit.getAction());
        assertNull(audit.getBeforeState());
        assertNotNull(audit.getOccurredAt());
        assertEquals("task-test", audit.getCorrelationId());
        var event = outboxRepository.findByActorIdAndRequestId(studentId, requestId).orElseThrow();
        assertEquals("TASK_CREATED", event.getEventType());
        assertEquals(TaskOutboxStatus.PENDING, event.getStatus());
        assertEquals("task-test", event.getCorrelationId());
        assertEquals(id.toString(), objectMapper.readTree(event.getPayload()).get("id").asText());
    }

    @Test
    void unassignedTaskMayOmitEstimateButAssignmentRequiresPositiveEstimate() throws Exception {
        create(request(), studentToken, UUID.randomUUID());
        for (Double hours : Arrays.asList(null, 0.0, -1.0)) {
            TaskDTO invalid = request();
            invalid.setAssigneeProjectMemberId(assigneeMemberId);
            invalid.setEstimatedHours(hours);
            mockMvc.perform(post("/api/tasks").header("Authorization", studentToken)
                            .contentType(MediaType.APPLICATION_JSON).content(json(invalid)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.errors.estimatedHours", hasItem("Estimate phải lớn hơn 0")));
        }
        assertEquals(1, taskRepository.count());
        assertEquals(1, auditRepository.count());
        assertEquals(1, outboxRepository.count());
    }

    @Test
    void invalidTitleTagsAndAssigneeReturn422WithoutWrites() throws Exception {
        for (String title : Arrays.asList(null, "   ", "x".repeat(251))) {
            TaskDTO invalid = request();
            invalid.setTitle(title);
            mockMvc.perform(post("/api/tasks").header("Authorization", studentToken)
                            .contentType(MediaType.APPLICATION_JSON).content(json(invalid)))
                    .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errors.title").isArray());
        }
        TaskDTO invalid = request();
        invalid.setTags(List.of(" "));
        mockMvc.perform(post("/api/tasks").header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(invalid)))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errors.tags").isArray());
        invalid.setTags(List.of());
        invalid.setAssigneeProjectMemberId(UUID.randomUUID());
        invalid.setEstimatedHours(2.0);
        mockMvc.perform(post("/api/tasks").header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(invalid)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.assigneeProjectMemberId").isArray());
        assertEquals(0, taskRepository.count());
    }

    @Test
    void assigneeUpdatesDetailsAndStaleVersionIsRejected() throws Exception {
        TaskDTO request = request();
        request.setAssigneeProjectMemberId(assigneeMemberId);
        request.setEstimatedHours(2.0);
        JsonNode created = create(request, teacherToken, UUID.randomUUID());
        UUID id = UUID.fromString(created.get("id").asText());
        TaskDTO update = objectMapper.treeToValue(created, TaskDTO.class);
        update.setTitle("API đã cập nhật");
        update.setEstimatedHours(3.5);
        update.setTags(List.of("Backend"));
        update.setCreatedBy(studentId);

        JsonNode changed = objectMapper.readTree(mockMvc.perform(put("/api/tasks/" + id)
                        .header("Authorization", studentToken).header("X-Correlation-ID", "update-test")
                        .contentType(MediaType.APPLICATION_JSON).content(json(update)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("TODO"))
                .andExpect(jsonPath("$.createdBy").value(teacherId))
                .andExpect(jsonPath("$.updatedBy").value(studentId))
                .andReturn().getResponse().getContentAsByteArray());
        assertTrue(changed.get("version").asLong() > update.getVersion());

        mockMvc.perform(put("/api/tasks/" + id).header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(update)))
                .andExpect(status().isConflict()).andExpect(header().exists("X-Correlation-ID"));
        assertEquals(2, auditRepository.count());
        assertEquals(2, outboxRepository.count());
        var audit = auditRepository.findByTaskIdOrderByOccurredAtAsc(id).getLast();
        assertEquals("Viết API", objectMapper.readTree(audit.getBeforeState()).get("title").asText());
        assertEquals("API đã cập nhật", objectMapper.readTree(audit.getAfterState()).get("title").asText());
    }

    @Test
    void creatorCannotEditAssignedTaskButProjectManagerCan() throws Exception {
        TaskDTO request = request();
        request.setAssigneeProjectMemberId(assigneeMemberId);
        request.setEstimatedHours(2.0);
        JsonNode created = create(request, teacherToken, UUID.randomUUID());
        TaskDTO update = objectMapper.treeToValue(created, TaskDTO.class);
        update.setTitle("Giao lại công việc");
        String url = "/api/tasks/" + created.get("id").asText();
        mockMvc.perform(put(url).header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(update)))
                .andExpect(status().isForbidden());

        when(projectAccess.isManager(projectId, teacherId)).thenReturn(true);
        mockMvc.perform(put(url).header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(update)))
                .andExpect(status().isOk());
    }

    @Test
    void taskDetailUpdateCannotBypassWorkflowOrMoveProject() throws Exception {
        JsonNode created = create(request(), studentToken, UUID.randomUUID());
        TaskDTO update = objectMapper.treeToValue(created, TaskDTO.class);
        String url = "/api/tasks/" + created.get("id").asText();
        update.setStatus(TaskStatus.DONE);
        mockMvc.perform(put(url).header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(update)))
                .andExpect(status().isConflict());
        update.setStatus(TaskStatus.TODO);
        update.setProjectId(otherProjectId);
        mockMvc.perform(put(url).header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(update)))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errors.projectId").isArray());
        assertEquals(1, auditRepository.count());
    }

    @Test
    void createAndUpdateRetriesReturnSavedResponseWithoutDuplicateEvents() throws Exception {
        TaskDTO request = request();
        request.setTags(List.of("API"));
        UUID createKey = UUID.randomUUID();
        JsonNode created = create(request, studentToken, createKey);
        JsonNode replay = create(request, studentToken, createKey);
        assertEquals(created, replay);
        assertEquals(1, taskRepository.count());
        assertEquals(1, tagRepository.count());

        TaskDTO update = objectMapper.treeToValue(created, TaskDTO.class);
        update.setTitle("Tên mới");
        UUID updateKey = UUID.randomUUID();
        String url = "/api/tasks/" + created.get("id").asText();
        byte[] changed = mockMvc.perform(put(url).header("Authorization", studentToken)
                        .header("Idempotency-Key", updateKey).contentType(MediaType.APPLICATION_JSON).content(json(update)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        mockMvc.perform(put(url).header("Authorization", studentToken).header("Idempotency-Key", updateKey)
                        .contentType(MediaType.APPLICATION_JSON).content(json(update)))
                .andExpect(status().isOk()).andExpect(result -> assertEquals(objectMapper.readTree(changed),
                        objectMapper.readTree(result.getResponse().getContentAsByteArray())));
        assertEquals(2, auditRepository.count());
        assertEquals(2, outboxRepository.count());

        request.setTitle("Không được dùng lại key cho nội dung khác");
        mockMvc.perform(post("/api/tasks").header("Authorization", studentToken).header("Idempotency-Key", createKey)
                        .contentType(MediaType.APPLICATION_JSON).content(json(request)))
                .andExpect(status().isConflict());
    }

    @Test
    void concurrentCreateWithSameKeyPersistsOneTaskAndOneEvent() throws Exception {
        CyclicBarrier barrier = new CyclicBarrier(2);
        doAnswer(invocation -> {
            Object result = invocation.callRealMethod();
            barrier.await(15, TimeUnit.SECONDS);
            return result;
        }).when(outboxSpy).findReplay(anyLong(), any(), anyString());
        UUID key = UUID.randomUUID();
        String body = json(request());
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> postStatus(body, key));
            var second = pool.submit(() -> postStatus(body, key));
            List<Integer> statuses = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
            assertEquals(1, statuses.stream().filter(status -> status == 200).count());
            assertEquals(1, statuses.stream().filter(status -> status == 409).count());
        }
        assertEquals(1, taskRepository.count());
        assertEquals(1, auditRepository.count());
        assertEquals(1, outboxRepository.count());
    }

    @Test
    void eventFailureRollsBackTaskTagsAndAudit() throws Exception {
        doThrow(new IllegalStateException("Simulated outbox failure")).when(outboxSpy)
                .enqueue(anyString(), any(), anyLong(), any(), anyString());
        TaskDTO request = request();
        request.setTags(List.of("Backend"));
        mockMvc.perform(post("/api/tasks").header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(request)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("Không thể xử lý yêu cầu Task"));
        assertEquals(0, taskRepository.count());
        assertEquals(0, tagRepository.count());
        assertEquals(0, auditRepository.count());
        assertEquals(0, outboxRepository.count());
    }

    @Test
    void projectScopeAndAuthenticationAreEnforcedOnReadAndWrite() throws Exception {
        JsonNode created = create(request(), studentToken, UUID.randomUUID());
        when(projectAccess.findProjectIds(teacherId)).thenReturn(Set.of(otherProjectId));
        mockMvc.perform(get("/api/tasks/" + created.get("id").asText()).header("Authorization", teacherToken))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.title").doesNotExist());
        mockMvc.perform(get("/api/tasks").header("Authorization", teacherToken).param("projectId", projectId.toString()))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/tasks").header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(request())))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/tasks/" + created.get("id").asText())).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/tasks/" + UUID.randomUUID()).header("Authorization", studentToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void listAndTagsAreFilteredByProjectAndSearch() throws Exception {
        TaskDTO first = request();
        first.setTags(List.of("Backend"));
        create(first, studentToken, UUID.randomUUID());
        TaskDTO second = request();
        second.setProjectId(otherProjectId);
        second.setTitle("Project khác");
        second.setTags(List.of("Frontend"));
        create(second, studentToken, UUID.randomUUID());
        mockMvc.perform(get("/api/tasks").header("Authorization", studentToken)
                        .param("projectId", projectId.toString()).param("search", "API").param("status", "TODO"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].title").value("Viết API"));
        mockMvc.perform(get("/api/tasks/tags").header("Authorization", studentToken)
                        .param("projectId", projectId.toString()).param("search", "back"))
                .andExpect(status().isOk()).andExpect(content().json("[\"Backend\"]"));
        mockMvc.perform(get("/api/tasks").header("Authorization", studentToken))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void repeatedTagNamesReuseOneTagWithinProject() throws Exception {
        TaskDTO first = request();
        first.setTags(List.of("Backend"));
        create(first, studentToken, UUID.randomUUID());
        first.setTags(List.of("backend"));
        create(first, studentToken, UUID.randomUUID());
        assertEquals(1, tagRepository.count());
        first.setProjectId(otherProjectId);
        create(first, studentToken, UUID.randomUUID());
        assertEquals(2, tagRepository.count());
    }

    @Test
    void malformedParametersAndInvalidEnumAreClientErrors() throws Exception {
        mockMvc.perform(get("/api/tasks/not-a-uuid").header("Authorization", studentToken))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/tasks/tags").header("Authorization", studentToken))
                .andExpect(status().isBadRequest());
        String body = "{\"projectId\":\"" + projectId + "\",\"title\":\"Task\",\"priority\":\"URGENT\"}";
        mockMvc.perform(post("/api/tasks").header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.priority").isArray());
    }

    private int postStatus(String body, UUID key) throws Exception {
        return mockMvc.perform(post("/api/tasks").header("Authorization", studentToken)
                        .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getStatus();
    }

    private TaskDTO request() {
        return TaskDTO.builder().projectId(projectId).title("Viết API").build();
    }

    private JsonNode create(TaskDTO request, String token, UUID key) throws Exception {
        byte[] response = mockMvc.perform(post("/api/tasks").header("Authorization", token)
                        .header("Idempotency-Key", key).header("X-Correlation-ID", "task-test")
                        .contentType(MediaType.APPLICATION_JSON).content(json(request)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        return objectMapper.readTree(response);
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private String token(String email) {
        return transactionTemplate.execute(status -> {
            var principal = userDetailsService.loadUserByUsername(email);
            return "Bearer " + tokenService.generateAccessToken(new UsernamePasswordAuthenticationToken(
                    principal, null, principal.getAuthorities()));
        });
    }
}
