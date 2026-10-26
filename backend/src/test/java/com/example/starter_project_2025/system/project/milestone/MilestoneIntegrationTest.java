package com.example.starter_project_2025.system.project.milestone;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository;
import com.example.starter_project_2025.system.project.milestone.idempotency.IdempotencyRepository;
import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventRepository;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneChecklistItemRepository;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactDraftRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.ArtifactAttachmentRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MilestoneIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired RefreshTokenService tokenService;
    @Autowired org.springframework.security.core.userdetails.UserDetailsService userDetailsService;
    @Autowired MilestoneRepository milestoneRepository;
    @Autowired MilestoneArtifactDraftRepository artifactDraftRepository;
    @Autowired ArtifactAttachmentRepository artifactAttachmentRepository;
    @Autowired MilestoneArtifactSubmissionRepository artifactSubmissionRepository;
    @Autowired MilestoneChecklistItemRepository checklistRepository;
    @Autowired MilestoneAuditRepository auditRepository;
    @Autowired OutboxEventRepository outboxRepository;
    @Autowired IdempotencyRepository idempotencyRepository;
    @Autowired com.example.starter_project_2025.system.rbac.user.UserRepository users;
    @Autowired com.example.starter_project_2025.system.rbac.role.RoleRepository roles;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private String teacherToken;
    private String studentToken;

    @BeforeEach
    void setUp() {
        idempotencyRepository.deleteAll();
        outboxRepository.deleteAll();
        auditRepository.deleteAll();
        artifactAttachmentRepository.deleteAll();
        artifactSubmissionRepository.deleteAll();
        artifactDraftRepository.deleteAll();
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
    void studentCanLoadAndSavePersistentDraftWithoutChangingMilestoneChecklist() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Artifact draft milestone", Instant.now().plusSeconds(86400), "artifact-draft-test"
        );
        String draftEndpoint = endpoint() + "/" + milestoneId + "/artifact-draft";
        String initial = mockMvc.perform(get(draftEndpoint).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.draft").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.milestone.title").value("Artifact draft milestone"))
                .andReturn().getResponse().getContentAsString();
        String itemId = objectMapper.readTree(initial).at("/milestone/checklist/0/id").asText();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("repositoryUrl", "https://github.com/example/project");
        body.put("deploymentUrl", "https://demo.example.com");
        body.put("releaseNotes", "Initial draft for review");
        body.put("checklist", Map.of(itemId, true));
        mockMvc.perform(put(draftEndpoint)
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.repositoryUrl").value("https://github.com/example/project"))
                .andExpect(jsonPath("$.checklist." + itemId).value(true));

        mockMvc.perform(put(draftEndpoint)
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"));

        mockMvc.perform(get(draftEndpoint).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.draft.status").value("DRAFT"))
                .andExpect(jsonPath("$.draft.releaseNotes").value("Initial draft for review"));

        var milestone = milestoneRepository.findByIdAndProjectIdAndTenantId(
                java.util.UUID.fromString(milestoneId), MockMilestoneData.PROJECT_ID, MockMilestoneData.TENANT_ID
        ).orElseThrow();
        org.junit.jupiter.api.Assertions.assertFalse(milestone.getChecklistItems().get(0).isCompleted());
        org.junit.jupiter.api.Assertions.assertEquals(1, artifactDraftRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(2, auditRepository.countByMilestoneId(
                java.util.UUID.fromString(milestoneId)));
        org.junit.jupiter.api.Assertions.assertEquals(2, outboxRepository.count());
    }

    @Test
    void failedDraftUpdateDoesNotReplacePreviouslySavedDraft() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Draft rollback milestone", Instant.now().plusSeconds(86400), "artifact-draft-rollback"
        );
        String draftEndpoint = endpoint() + "/" + milestoneId + "/artifact-draft";
        String initial = mockMvc.perform(get(draftEndpoint).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String itemId = objectMapper.readTree(initial).at("/milestone/checklist/0/id").asText();
        Map<String, Object> first = new LinkedHashMap<>();
        first.put("repositoryUrl", "https://github.com/example/kept");
        first.put("checklist", Map.of(itemId, true));
        String firstSaved = mockMvc.perform(put(draftEndpoint)
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(first)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long version = objectMapper.readTree(firstSaved).get("version").asLong();

        Map<String, Object> invalidUpdate = new LinkedHashMap<>();
        invalidUpdate.put("repositoryUrl", "javascript:alert(1)");
        invalidUpdate.put("releaseNotes", "must not overwrite existing draft");
        invalidUpdate.put("checklist", Map.of(itemId, false));
        invalidUpdate.put("expectedVersion", version);
        mockMvc.perform(put(draftEndpoint)
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidUpdate)))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(get(draftEndpoint).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.draft.repositoryUrl").value("https://github.com/example/kept"))
                .andExpect(jsonPath("$.draft.releaseNotes").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.draft.checklist." + itemId).value(true));
    }

    @Test
    void artifactWorkspaceEnforcesAuthenticationStudentRoleAndMilestoneScope() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Scoped artifact milestone", Instant.now().plusSeconds(86400), "artifact-draft-scope"
        );
        String draftEndpoint = endpoint() + "/" + milestoneId + "/artifact-draft";
        mockMvc.perform(get(draftEndpoint))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(draftEndpoint).header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(endpoint() + "/99999999-9999-9999-9999-999999999999/artifact-draft")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/projects/" + MockMilestoneData.OUT_OF_SCOPE_PROJECT_ID
                        + "/milestones/" + milestoneId + "/artifact-draft")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.milestone").doesNotExist());
        mockMvc.perform(get(draftEndpoint)
                        .header("Authorization", "Bearer " + tokenForUnassignedStudent()))
                .andExpect(status().isForbidden());
        org.junit.jupiter.api.Assertions.assertEquals(0, artifactDraftRepository.count());
    }

    @Test
    void fileUploadFailsClosedWhenMimeSizeAndScannerPolicyIsNotConfigured() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Upload policy milestone", Instant.now().plusSeconds(86400), "artifact-upload-policy"
        );
        var file = new org.springframework.mock.web.MockMultipartFile(
                "file", "demo.pdf", "application/pdf", "%PDF-test".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        mockMvc.perform(multipart(endpoint() + "/" + milestoneId + "/artifact-draft/attachments")
                        .file(file).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("ARTIFACT_UPLOAD_UNAVAILABLE"));
        org.junit.jupiter.api.Assertions.assertEquals(0, artifactAttachmentRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(0, artifactDraftRepository.count());
    }

    @Test
    void studentSubmissionCreatesImmutableVersionAndReplaysSameIdempotencyKey() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Artifact submission milestone", Instant.now().plusSeconds(86400), "artifact-submit-success"
        );
        String submitUrl = endpoint() + "/" + milestoneId + "/artifact-draft/submissions";
        Map<String, Object> body = Map.of(
                "repositoryUrl", "https://github.com/example/submitted-v1",
                "releaseNotes", "Release one",
                "checklist", Map.of()
        );
        String first = mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-retry-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.repositoryUrl").value("https://github.com/example/submitted-v1"))
                .andExpect(jsonPath("$.submittedLate").value(false))
                .andReturn().getResponse().getContentAsString();

        String replay = mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-retry-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        org.junit.jupiter.api.Assertions.assertEquals(
                objectMapper.readTree(first).get("id").asText(), objectMapper.readTree(replay).get("id").asText());
        String submittedId = objectMapper.readTree(first).get("id").asText();
        MilestoneArtifactSubmission immutable = artifactSubmissionRepository
                .findById(java.util.UUID.fromString(submittedId)).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(1, immutable.getVersion());
        org.junit.jupiter.api.Assertions.assertEquals("https://github.com/example/submitted-v1",
                immutable.getRepositoryUrl());
        mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-retry-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "repositoryUrl", "https://github.com/example/different",
                                "checklist", Map.of()))))
                .andExpect(status().isConflict());
        org.junit.jupiter.api.Assertions.assertEquals(1, artifactSubmissionRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(1, idempotencyRepository.countByOperation("ARTIFACT_SUBMISSION"));
        org.junit.jupiter.api.Assertions.assertEquals(2, auditRepository.countByMilestoneId(
                java.util.UUID.fromString(milestoneId)));
        org.junit.jupiter.api.Assertions.assertEquals(2, outboxRepository.count());
        mockMvc.perform(get(endpoint() + "/" + milestoneId + "/artifact-draft")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latestSubmission.version").value(1))
                .andExpect(jsonPath("$.latestSubmission.status").value("SUBMITTED"));
    }

    @Test
    void invalidSubmissionAndRejectedLatePolicyDoNotCreateSubmittedVersion() throws Exception {
        Instant futureDeadline = Instant.now().plusSeconds(3600);
        Map<String, Object> noLateMilestone = validRequest("Artifact invalid submission", futureDeadline);
        noLateMilestone.put("latePolicy", Map.of("type", "NO_LATE"));
        String milestoneId = createMilestoneAndGetId(noLateMilestone, "artifact-submit-denied");
        jdbcTemplate.update("update milestones set deadline = ? where milestone_id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(600)), java.util.UUID.fromString(milestoneId));
        String submitUrl = endpoint() + "/" + milestoneId + "/artifact-draft/submissions";
        mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-empty")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("checklist", Map.of()))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.artifact").exists());
        mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-late-denied")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "repositoryUrl", "https://github.com/example/project",
                                "checklist", Map.of()))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.deadline").exists());
        mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-invalid-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "repositoryUrl", "javascript:alert(1)", "checklist", Map.of()))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.repositoryUrl").exists());
        mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-invalid-attachment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "repositoryUrl", "https://github.com/example/project",
                                "checklist", Map.of(),
                                "attachmentIds", List.of(java.util.UUID.randomUUID())))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.attachments").exists());
        org.junit.jupiter.api.Assertions.assertEquals(0, artifactSubmissionRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(0, idempotencyRepository.countByOperation("ARTIFACT_SUBMISSION"));
        org.junit.jupiter.api.Assertions.assertEquals(1, auditRepository.countByMilestoneId(
                java.util.UUID.fromString(milestoneId)));
        org.junit.jupiter.api.Assertions.assertEquals(1, outboxRepository.count());
    }

    @Test
    void concurrentRetryWithSameSubmissionKeyCreatesOnlyOneVersionAndOutboxEvent() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Concurrent artifact submission", Instant.now().plusSeconds(86400), "artifact-submit-concurrent"
        );
        String submitUrl = endpoint() + "/" + milestoneId + "/artifact-draft/submissions";
        String body = objectMapper.writeValueAsString(Map.of(
                "repositoryUrl", "https://github.com/example/concurrent", "checklist", Map.of()));
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var submitRequest = (java.util.concurrent.Callable<org.springframework.test.web.servlet.MvcResult>) () -> {
                start.await();
                return mockMvc.perform(post(submitUrl)
                                .header("Authorization", "Bearer " + studentToken)
                                .header("Idempotency-Key", "artifact-submit-same-concurrent-key")
                                .contentType(MediaType.APPLICATION_JSON).content(body))
                        .andReturn();
            };
            var first = executor.submit(submitRequest);
            var second = executor.submit(submitRequest);
            start.countDown();
            var firstResult = first.get(20, TimeUnit.SECONDS);
            var secondResult = second.get(20, TimeUnit.SECONDS);
            org.junit.jupiter.api.Assertions.assertEquals(201, firstResult.getResponse().getStatus());
            org.junit.jupiter.api.Assertions.assertEquals(201, secondResult.getResponse().getStatus());
            var firstResponse = objectMapper.readTree(firstResult.getResponse().getContentAsString());
            var secondResponse = objectMapper.readTree(secondResult.getResponse().getContentAsString());
            org.junit.jupiter.api.Assertions.assertEquals(firstResponse.get("id").asText(),
                    secondResponse.get("id").asText());
        }
        org.junit.jupiter.api.Assertions.assertEquals(1, artifactSubmissionRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(1, idempotencyRepository.countByOperation("ARTIFACT_SUBMISSION"));
        org.junit.jupiter.api.Assertions.assertEquals(2, auditRepository.countByMilestoneId(
                java.util.UUID.fromString(milestoneId)));
        org.junit.jupiter.api.Assertions.assertEquals(2, outboxRepository.count());
    }

    @Test
    void allowedLateSubmissionIsAcceptedAccordingToMilestonePolicyAndNewKeyCreatesNewVersion() throws Exception {
        Instant deadline = Instant.now().plusSeconds(3600);
        String milestoneId = createMilestoneAndGetId(
                "Artifact late submission", deadline, "artifact-submit-late-allowed"
        );
        jdbcTemplate.update("update milestones set deadline = ? where milestone_id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(600)), java.util.UUID.fromString(milestoneId));
        String submitUrl = endpoint() + "/" + milestoneId + "/artifact-draft/submissions";
        Map<String, Object> firstBody = Map.of(
                "deploymentUrl", "https://demo.example.com",
                "releaseNotes", "Late delivery v1",
                "checklist", Map.of()
        );
        String first = mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-new-version-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(firstBody)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.submittedLate").value(true))
                .andExpect(jsonPath("$.latePenaltyPercent").value(10.0))
                .andExpect(jsonPath("$.version").value(1))
                .andReturn().getResponse().getContentAsString();

        Map<String, Object> secondBody = Map.of(
                "deploymentUrl", "https://demo-v2.example.com",
                "releaseNotes", "Late delivery v2",
                "checklist", Map.of()
        );
        String second = mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-new-version-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(secondBody)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.deploymentUrl").value("https://demo-v2.example.com"))
                .andReturn().getResponse().getContentAsString();

        String replay = mockMvc.perform(post(submitUrl)
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-new-version-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(secondBody)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();

        var firstResponse = objectMapper.readTree(first);
        var secondResponse = objectMapper.readTree(second);
        org.junit.jupiter.api.Assertions.assertEquals(secondResponse.get("id").asText(),
                objectMapper.readTree(replay).get("id").asText());
        var firstStored = artifactSubmissionRepository.findById(
                java.util.UUID.fromString(firstResponse.get("id").asText())).orElseThrow();
        var secondStored = artifactSubmissionRepository.findById(
                java.util.UUID.fromString(secondResponse.get("id").asText())).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(1, firstStored.getVersion());
        org.junit.jupiter.api.Assertions.assertEquals("https://demo.example.com", firstStored.getDeploymentUrl());
        org.junit.jupiter.api.Assertions.assertEquals("Late delivery v1", firstStored.getReleaseNotes());
        org.junit.jupiter.api.Assertions.assertEquals(2, secondStored.getVersion());
        org.junit.jupiter.api.Assertions.assertEquals(firstStored.getMilestoneId(), secondStored.getMilestoneId());
        org.junit.jupiter.api.Assertions.assertEquals(firstStored.getProjectId(), secondStored.getProjectId());
        org.junit.jupiter.api.Assertions.assertEquals(2, artifactSubmissionRepository.count());
        org.junit.jupiter.api.Assertions.assertEquals(2, idempotencyRepository.countByOperation("ARTIFACT_SUBMISSION"));
        org.junit.jupiter.api.Assertions.assertEquals(2, auditRepository.countByMilestoneIdAndAction(
                java.util.UUID.fromString(milestoneId), "ARTIFACT_SUBMITTED"));
        org.junit.jupiter.api.Assertions.assertEquals(2, outboxRepository.countByEventType("ARTIFACT_SUBMITTED"));

        var submissionAudits = auditRepository.findAllByMilestoneIdAndActionOrderByCreatedAtAsc(
                java.util.UUID.fromString(milestoneId), "ARTIFACT_SUBMITTED");
        var resubmissionAudit = objectMapper.readTree(submissionAudits.get(1).getDetailsJson());
        org.junit.jupiter.api.Assertions.assertEquals(1, resubmissionAudit.at("/before/version").asInt());
        org.junit.jupiter.api.Assertions.assertEquals("https://demo.example.com",
                resubmissionAudit.at("/before/deploymentUrl").asText());
        org.junit.jupiter.api.Assertions.assertEquals(2, resubmissionAudit.at("/after/version").asInt());
        org.junit.jupiter.api.Assertions.assertTrue(
                resubmissionAudit.path("changedFields").toString().contains("\"deploymentUrl\""));
    }

    @Test
    void submissionEnforcesAuthenticationRoleAndProjectMilestoneScope() throws Exception {
        String milestoneId = createMilestoneAndGetId(
                "Artifact submission scope", Instant.now().plusSeconds(86400), "artifact-submit-scope"
        );
        String submitUrl = endpoint() + "/" + milestoneId + "/artifact-draft/submissions";
        String body = objectMapper.writeValueAsString(Map.of(
                "repositoryUrl", "https://github.com/example/project", "checklist", Map.of()));
        mockMvc.perform(post(submitUrl).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post(submitUrl).header("Authorization", "Bearer " + teacherToken)
                        .header("Idempotency-Key", "artifact-submit-teacher")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/projects/" + MockMilestoneData.OUT_OF_SCOPE_PROJECT_ID
                        + "/milestones/" + milestoneId + "/artifact-draft/submissions")
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-out-of-scope")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(endpoint() + "/99999999-9999-9999-9999-999999999999/artifact-draft/submissions")
                        .header("Authorization", "Bearer " + studentToken)
                        .header("Idempotency-Key", "artifact-submit-missing")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
        org.junit.jupiter.api.Assertions.assertEquals(0, artifactSubmissionRepository.count());
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

    private String tokenForUnassignedStudent() {
        var studentRole = roles.findByName("STUDENT").orElseThrow();
        var user = new com.example.starter_project_2025.system.rbac.user.User();
        user.setEmail("unassigned-artifact-student@example.com");
        user.setPasswordHash("unused");
        user.setFirstName("Unassigned artifact");
        user.setLastName("Student");
        user.setTenant(users.findByEmail("student@example.com").orElseThrow().getTenant());
        user.getRoles().add(studentRole);
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
