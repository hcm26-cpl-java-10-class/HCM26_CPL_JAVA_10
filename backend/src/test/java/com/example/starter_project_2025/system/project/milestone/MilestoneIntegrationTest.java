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
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
    @Autowired com.example.starter_project_2025.system.rbac.user.UserRepository users;
    @Autowired com.example.starter_project_2025.system.rbac.role.RoleRepository roles;

    private String teacherToken;
    private String studentToken;

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
        var student = userDetailsService.loadUserByUsername("student@example.com");
        studentToken = tokenService.generateAccessToken(
                new UsernamePasswordAuthenticationToken(student, null, student.getAuthorities()));
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

    @Test
    void returnsEmptyPageForProjectWithoutMilestones() throws Exception {
        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Correlation-ID"))
                .andExpect(jsonPath("$.project.id").value(MockMilestoneData.PROJECT_ID.toString()))
                .andExpect(jsonPath("$.project.name").value("OJT Management System"))
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0))
                .andExpect(jsonPath("$.hasNext").value(false))
                .andExpect(jsonPath("$.hasPrevious").value(false));
    }

    @Test
    void returnsOnlyRequestedPageOrderedByDeadlineAscending() throws Exception {
        createMilestone("Third milestone", Instant.now().plusSeconds(3 * 86400L), "list-third");
        createMilestone("First milestone", Instant.now().plusSeconds(86400L), "list-first");
        createMilestone("Second milestone", Instant.now().plusSeconds(2 * 86400L), "list-second");

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("page", "0")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].title").value("First milestone"))
                .andExpect(jsonPath("$.content[1].title").value("Second milestone"))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.hasNext").value(true))
                .andExpect(jsonPath("$.hasPrevious").value(false));

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("page", "1")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].title").value("Third milestone"))
                .andExpect(jsonPath("$.hasNext").value(false))
                .andExpect(jsonPath("$.hasPrevious").value(true));
    }

    @Test
    void sortsMilestonesByRequestedColumnAndDirection() throws Exception {
        createMilestone("Alpha milestone", Instant.now().plusSeconds(3 * 86400L), "sort-alpha");
        createMilestone("Zulu milestone", Instant.now().plusSeconds(86400L), "sort-zulu");

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("sort", "title:desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].title").value("Zulu milestone"))
                .andExpect(jsonPath("$.content[1].title").value("Alpha milestone"));
    }

    @Test
    void sortsRubricsByRequestedColumnAndDirection() throws Exception {
        mockMvc.perform(get("/api/rubrics")
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("sort", "name:desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Technical Documentation Rubric"))
                .andExpect(jsonPath("$.content[1].name").value("Milestone Delivery Rubric"))
                .andExpect(jsonPath("$.content[2].name").value("Demo and Presentation Rubric"));
    }

    @Test
    void searchesTitleAndDescriptionCaseInsensitivelyAndEscapesWildcards() throws Exception {
        createMilestone("Alpha Release", Instant.now().plusSeconds(86400L), "search-alpha");
        createMilestone("Release 100%", Instant.now().plusSeconds(2 * 86400L), "search-percent");

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("search", "  aLpHa  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].title").value("Alpha Release"));

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("search", "FIRST milestone"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("search", "%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].title").value("Release 100%"));
    }

    @Test
    void combinesStatusMandatoryAndLatePolicyFilters() throws Exception {
        createMilestone("Required delivery", Instant.now().plusSeconds(86400L), "filter-required");
        Map<String, Object> optional = validRequest("Optional review", Instant.now().plusSeconds(2 * 86400L));
        optional.put("mandatory", false);
        optional.put("latePolicy", Map.of("type", "NO_LATE"));
        createMilestone(optional, "filter-optional");

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("status", "PLANNED", "CLOSED")
                        .param("mandatory", "false")
                        .param("latePolicyType", "NO_LATE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].title").value("Optional review"));
    }

    @Test
    void filtersDeadlineByInclusiveTenantLocalDates() throws Exception {
        ZoneId tenantZone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate includedDate = LocalDate.now(tenantZone).plusDays(3);
        LocalDate excludedDate = includedDate.plusDays(1);
        createMilestone(
                "Included deadline",
                includedDate.atTime(12, 0).atZone(tenantZone).toInstant(),
                "filter-deadline-included"
        );
        createMilestone(
                "Excluded deadline",
                excludedDate.atTime(12, 0).atZone(tenantZone).toInstant(),
                "filter-deadline-excluded"
        );

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("deadlineFrom", includedDate.toString())
                        .param("deadlineTo", includedDate.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].title").value("Included deadline"));
    }

    @Test
    void rejectsInvalidMilestoneFilters() throws Exception {
        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("deadlineFrom", "2026-11-02")
                        .param("deadlineTo", "2026-11-01"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.deadlineFrom").isArray());

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("search", "x".repeat(121)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.search").isArray());

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("status", "UNKNOWN"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.status").isArray());
    }

    @Test
    void rejectsInvalidPaginationWithFieldErrors() throws Exception {
        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("size", "0"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.size").isArray());

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("size", "101"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.size").isArray());

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("page", "-1"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.page").isArray());

        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("size", "not-a-number"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.size").isArray());
    }

    @Test
    void rejectsUnauthenticatedListRequest() throws Exception {
        mockMvc.perform(get(endpoint()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsListRequestWithoutReadPermission() throws Exception {
        mockMvc.perform(get(endpoint())
                        .header("Authorization", "Bearer " + tokenWithoutMilestonePermissions()))
                .andExpect(status().isForbidden());
    }

    @Test
    void studentWithReadPermissionCanReadButCannotCreate() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Student readable milestone", Instant.now().plusSeconds(86400), "student-read"
        );
        mockMvc.perform(get(endpoint()).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk());
        mockMvc.perform(get(endpoint() + "/" + milestoneId).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk());
        mockMvc.perform(post(endpoint()).header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "student-must-not-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(endpoint() + "/create-options").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsProjectOutsideCurrentScopeWithoutReturningProjectData() throws Exception {
        mockMvc.perform(get("/api/projects/" + MockMilestoneData.OUT_OF_SCOPE_PROJECT_ID + "/milestones")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.project").doesNotExist());
    }

    @Test
    void returnsNotFoundForUnknownProject() throws Exception {
        mockMvc.perform(get("/api/projects/99999999-9999-9999-9999-999999999999/milestones")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void returnsCompleteMilestoneDetailWithStoredOrderAndTenantTimeZone() throws Exception {
        Instant deadline = Instant.now().plusSeconds(86400).truncatedTo(ChronoUnit.MILLIS);
        String milestoneId = createMilestoneAndGetId(
                "Detailed milestone", deadline, "detail-complete"
        );

        mockMvc.perform(get(endpoint() + "/" + milestoneId)
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(milestoneId))
                .andExpect(jsonPath("$.project.id").value(MockMilestoneData.PROJECT_ID.toString()))
                .andExpect(jsonPath("$.project.name").value("OJT Management System"))
                .andExpect(jsonPath("$.title").value("Detailed milestone"))
                .andExpect(jsonPath("$.deadline").value(deadline.toString()))
                .andExpect(jsonPath("$.tenantTimeZone").value("Asia/Ho_Chi_Minh"))
                .andExpect(jsonPath("$.checklist.length()").value(2))
                .andExpect(jsonPath("$.checklist[0].orderIndex").value(0))
                .andExpect(jsonPath("$.checklist[0].content").value("Source code is pushed"))
                .andExpect(jsonPath("$.checklist[1].orderIndex").value(1))
                .andExpect(jsonPath("$.rubric.name").value("Milestone Delivery Rubric"))
                .andExpect(jsonPath("$.rubric.version").value("v1"))
                .andExpect(jsonPath("$.rubric.criteria.length()").value(3))
                .andExpect(jsonPath("$.rubric.criteria[0].code").value("FUNCTIONALITY"))
                .andExpect(jsonPath("$.rubric.criteria[0].weight").value(50.00))
                .andExpect(jsonPath("$.rubric.criteria[0].maxScore").value(5.00))
                .andExpect(jsonPath("$.reviewer").doesNotExist())
                .andExpect(jsonPath("$.latePolicy.type").value("ALLOW_LATE"))
                .andExpect(jsonPath("$.latePolicy.penaltyPercent").value(10.00));
    }

    @Test
    void returnsNotFoundWhenMilestoneIsRequestedThroughAnotherInScopeProject() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Project A milestone", Instant.now().plusSeconds(86400), "detail-wrong-project"
        );

        mockMvc.perform(get("/api/projects/" + MockMilestoneData.SECOND_PROJECT_ID
                        + "/milestones/" + milestoneId)
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.checklist").doesNotExist())
                .andExpect(jsonPath("$.rubric").doesNotExist());
    }

    @Test
    void returnsNotFoundForUnknownMilestoneInsidePermittedProject() throws Exception {
        mockMvc.perform(get(endpoint() + "/99999999-9999-9999-9999-999999999999")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.title").doesNotExist());
    }

    @Test
    void returnsForbiddenBeforeLookingUpMilestoneForOutOfScopeProject() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Protected milestone", Instant.now().plusSeconds(86400), "detail-out-of-scope"
        );

        mockMvc.perform(get("/api/projects/" + MockMilestoneData.OUT_OF_SCOPE_PROJECT_ID
                        + "/milestones/" + milestoneId)
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.title").doesNotExist());
    }

    @Test
    void rejectsMilestoneDetailWithoutReadPermission() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Teacher milestone", Instant.now().plusSeconds(86400), "detail-no-permission"
        );

        mockMvc.perform(get(endpoint() + "/" + milestoneId)
                        .header("Authorization", "Bearer " + tokenWithoutMilestonePermissions()))
                .andExpect(status().isForbidden());
    }

    private String tokenWithoutMilestonePermissions() {
        var role = roles.findByName("MILESTONE_NO_PERMISSION_TEST").orElseGet(() -> roles.saveAndFlush(
                com.example.starter_project_2025.system.rbac.role.Role.builder()
                        .name("MILESTONE_NO_PERMISSION_TEST").build()));
        var user = new com.example.starter_project_2025.system.rbac.user.User();
        user.setEmail(java.util.UUID.randomUUID() + "@milestone.test");
        user.setPasswordHash("unused");
        user.setFirstName("No milestone permission");
        user.setLastName("Test");
        user.setTenant(users.findByEmail("student@example.com").orElseThrow().getTenant());
        user.getRoles().add(role);
        users.saveAndFlush(user);
        var principal = userDetailsService.loadUserByUsername(user.getEmail());
        return tokenService.generateAccessToken(new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities()));
    }

    private String endpoint() {
        return "/api/projects/" + MockMilestoneData.PROJECT_ID + "/milestones";
    }

    private Map<String, Object> validRequest() {
        Instant deadline = Instant.now().plusSeconds(86400);
        return validRequest("Sprint 1 Delivery", deadline);
    }

    private Map<String, Object> validRequest(String title, Instant deadline) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", title);
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

    private void createMilestone(String title, Instant deadline, String key) throws Exception {
        createMilestoneAndGetId(title, deadline, key);
    }

    private void createMilestone(Map<String, Object> body, String key) throws Exception {
        createMilestoneAndGetId(body, key);
    }

    private String createMilestoneAndGetId(String title, Instant deadline, String key) throws Exception {
        return createMilestoneAndGetId(validRequest(title, deadline), key);
    }

    private String createMilestoneAndGetId(Map<String, Object> body, String key) throws Exception {
        String response = mockMvc.perform(post(endpoint())
                        .header("Authorization", "Bearer " + teacherToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asText();
    }

}
