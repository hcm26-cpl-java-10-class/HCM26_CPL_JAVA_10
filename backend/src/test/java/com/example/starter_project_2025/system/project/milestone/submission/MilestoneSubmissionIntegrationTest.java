package com.example.starter_project_2025.system.project.milestone.submission;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.milestone.submission.repository.SubmissionAuditRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.SubmissionOutboxRepository;
import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneSubmission;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import com.example.starter_project_2025.system.project.milestone.submission.domain.SubmissionVersion;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.SubmissionVersionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "milestone.submission.mock.seed-enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MilestoneSubmissionIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired RefreshTokenService tokenService;
    @Autowired org.springframework.security.core.userdetails.UserDetailsService userDetailsService;
    @Autowired SubmissionAuditRepository audits;
    @Autowired SubmissionOutboxRepository outbox;
    @Autowired MilestoneRepository milestones;
    @Autowired MilestoneSubmissionRepository submissions;
    @Autowired SubmissionVersionRepository versions;
    @Autowired com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactSubmissionRepository artifactSubmissions;

    @Test
    void reviewDetailUsesLatestArtifactSubmissionAsProductInformation() throws Exception {
        JsonNode detail = submittedDetail();
        UUID milestoneId = UUID.fromString(detail.get("milestoneId").asText());
        long projectId = detail.get("projectId").asLong();
        UUID submitterId = UUID.fromString(detail.get("studentId").asText());
        Instant submittedAt = Instant.now();
        artifactSubmissions.saveAndFlush(MilestoneArtifactSubmission.submit(
                MockMilestoneData.TENANT_ID, projectId, milestoneId, submitterId, 2,
                "https://github.com/example/actual-product",
                "https://actual-product.example.com",
                "Actual release notes from the artifact form",
                "{}",
                "[{\"id\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\",\"fileName\":\"release.pdf\",\"contentType\":\"application/pdf\",\"sizeBytes\":2048}]",
                submittedAt, false, null));

        mockMvc.perform(get("/api/milestone-submissions/{id}", detail.get("id").asText())
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.product.version").value(2))
                .andExpect(jsonPath("$.product.repositoryUrl").value("https://github.com/example/actual-product"))
                .andExpect(jsonPath("$.product.deploymentUrl").value("https://actual-product.example.com"))
                .andExpect(jsonPath("$.product.releaseNotes").value("Actual release notes from the artifact form"))
                .andExpect(jsonPath("$.product.attachments[0].fileName").value("release.pdf"))
                .andExpect(jsonPath("$.product.attachments[0].sizeBytes").value(2048));
    }

    @Test
    void rejectRequiresStructuredFeedbackAndKeepsSubmissionUnchanged() throws Exception {
        JsonNode detail = submittedDetail();
        String id = detail.get("id").asText();
        Map<String, Object> request = reviewRequest(detail, "REJECT", "");

        mockMvc.perform(post("/api/milestone-submissions/{id}/review", id)
                        .header("Authorization", bearer())
                        .header("Idempotency-Key", "reject-missing-feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors['criteria[0].feedback']").isArray());

        mockMvc.perform(get("/api/milestone-submissions/{id}", id)
                        .header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.reviews").isEmpty());
    }

    @Test
    void pendingQueueContainsTheSixAdditionalSeedSubmissions() throws Exception {
        mockMvc.perform(get("/api/milestone-submissions")
                        .header("Authorization", bearer())
                        .param("bucket", "PENDING")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(7))
                .andExpect(jsonPath("$.content[?(@.teamName == 'Atlas Team')]").exists())
                .andExpect(jsonPath("$.content[?(@.teamName == 'Byte Builders')]").exists())
                .andExpect(jsonPath("$.content[?(@.teamName == 'Code Crafters')]").exists())
                .andExpect(jsonPath("$.content[?(@.teamName == 'Delta Squad')]").exists())
                .andExpect(jsonPath("$.content[?(@.teamName == 'Eclipse Team')]").exists())
                .andExpect(jsonPath("$.content[?(@.teamName == 'Fusion Lab')]").exists());
    }

    @Test
    void rejectsFeedbackLongerThanFiveHundredCharacters() throws Exception {
        JsonNode detail = submittedDetail();
        mockMvc.perform(post("/api/milestone-submissions/{id}/review", detail.get("id").asText())
                        .header("Authorization", bearer())
                        .header("Idempotency-Key", "reject-long-feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reviewRequest(detail, "REJECT", "x".repeat(501)))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors['criteria[0].feedback']").isArray());
    }

    @Test
    void rejectMovesSubmissionAndMilestoneTaskToTerminalStatesAndEmitsSideEffects() throws Exception {
        JsonNode detail = submittedDetail();
        long auditBefore = audits.count();
        long eventBefore = outbox.count();

        mockMvc.perform(post("/api/milestone-submissions/{id}/review", detail.get("id").asText())
                        .header("Authorization", bearer())
                        .header("Idempotency-Key", "reject-success")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reviewRequest(detail, "REJECT", "Does not meet this rubric criterion."))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.executionStatus").value("FAILED"))
                .andExpect(jsonPath("$.reviews[0].decision").value("REJECT"))
                .andExpect(jsonPath("$.reviews[0].rawScore").value(0))
                .andExpect(jsonPath("$.reviews[0].finalScore").value(0));

        assertEquals(auditBefore + 1, audits.count());
        assertEquals(eventBefore + 1, outbox.count());
        long artifactCount = artifactSubmissions.count();
        mockMvc.perform(post("/api/projects/{projectId}/milestones/{milestoneId}/artifact-draft/submissions",
                        detail.get("projectId").asLong(), detail.get("milestoneId").asText())
                        .header("Authorization", studentBearer())
                        .header("Idempotency-Key", "cannot-resubmit-rejected-artifact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repositoryUrl\":\"https://github.com/example/rejected-v2\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Submission was REJECTED (0 points). Resubmission is not permitted."));
        mockMvc.perform(post("/api/milestone-submissions/{id}/versions", detail.get("id").asText())
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Rejected resubmission\"}"))
                .andExpect(status().isConflict());
        assertEquals(artifactCount, artifactSubmissions.count());
        assertEquals(auditBefore + 1, audits.count());
        assertEquals(eventBefore + 1, outbox.count());
    }

    @Test
    void requestChangesKeepsOldVersionImmutableAndOpensExactlyOneNextDraft() throws Exception {
        JsonNode detail = submittedDetail();
        String id = detail.get("id").asText();

        String changed = mockMvc.perform(post("/api/milestone-submissions/{id}/review", id)
                        .header("Authorization", bearer())
                        .header("Idempotency-Key", "request-changes-success")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reviewRequest(detail, "REQUEST_CHANGES", "Please address this criterion."))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.currentVersion.status").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.availableActions.createNextVersion").value(true))
                .andReturn().getResponse().getContentAsString();
        assertEquals(1, objectMapper.readTree(changed).get("currentVersionNumber").asInt());
        assertEquals(com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus.CHANGES_REQUESTED,
                milestones.findById(UUID.fromString(detail.get("milestoneId").asText()))
                        .orElseThrow().lifecycleStatus());

        String draft = mockMvc.perform(post("/api/milestone-submissions/{id}/versions", id)
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Corrected delivery","notes":"Applied reviewer feedback","submissionUrl":"https://example.com/v2"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.currentVersionNumber").value(2))
                .andExpect(jsonPath("$.versions[0].versionNumber").value(2))
                .andExpect(jsonPath("$.versions[0].status").value("DRAFT"))
                .andExpect(jsonPath("$.versions[1].versionNumber").value(1))
                .andExpect(jsonPath("$.versions[1].status").value("CHANGES_REQUESTED"))
                .andReturn().getResponse().getContentAsString();

        String versionId = objectMapper.readTree(draft).get("currentVersion").get("id").asText();
        mockMvc.perform(put("/api/milestone-submissions/{id}/versions/{versionId}", id, versionId)
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title":"Corrected delivery ready for review",
                                  "notes":"All reviewer comments were addressed",
                                  "artifacts":[
                                    {"type":"REPOSITORY","name":"Backend repository","url":"https://github.com/example/backend-v2"},
                                    {"type":"DOCUMENTATION","name":"API documentation","url":"https://docs.example.com/backend-v2"}
                                  ],
                                  "checklist":[
                                    {"content":"All required APIs implemented","mandatory":true,"completed":true,"evidenceNote":"See repository"},
                                    {"content":"Integration tests completed","mandatory":true,"completed":false,"evidenceNote":"In progress"}
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion.title").value("Corrected delivery ready for review"))
                .andExpect(jsonPath("$.currentVersion.artifacts.length()").value(2))
                .andExpect(jsonPath("$.currentVersion.artifacts[0].type").value("REPOSITORY"))
                .andExpect(jsonPath("$.currentVersion.checklist.length()").value(4))
                // A student's draft payload cannot complete acceptance criteria; only the reviewer can.
                .andExpect(jsonPath("$.currentVersion.checklist[0].completed").value(false))
                .andExpect(jsonPath("$.versions[1].versionNumber").value(1))
                .andExpect(jsonPath("$.versions[1].status").value("CHANGES_REQUESTED"));

        mockMvc.perform(post("/api/milestone-submissions/{id}/versions", id)
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Unexpected v3\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/milestone-submissions/{id}/submit", id)
                        .header("Authorization", bearer())
                        .header("Idempotency-Key", "resubmit-v2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.currentVersionNumber").value(2));
    }

    @Test
    void requestChangesRequiresRevisionInstructions() throws Exception {
        JsonNode detail = submittedDetail();
        Map<String, Object> request = reviewRequest(detail, "REQUEST_CHANGES", "Please revise this criterion.");
        request.remove("overallFeedback");

        mockMvc.perform(post("/api/milestone-submissions/{id}/review", detail.get("id").asText())
                        .header("Authorization", bearer())
                        .header("Idempotency-Key", "request-changes-without-instructions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.overallFeedback").isArray());
    }

    @Test
    void studentMySubmissionsAreFilteredByAuthenticatedOwner() throws Exception {
        mockMvc.perform(get("/api/milestone-submissions/mine")
                        .header("Authorization", studentBearer())
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.content[?(@.studentName == 'Student Demo')]").exists())
                .andExpect(jsonPath("$.content[?(@.teamName == 'Atlas Team')]").doesNotExist());
    }

    @Test
    void studentCannotReadAnotherStudentsSubmission() throws Exception {
        String page = mockMvc.perform(get("/api/milestone-submissions")
                        .header("Authorization", bearer())
                        .param("search", "Atlas Team"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(page).get("content").get(0).get("id").asText();

        mockMvc.perform(get("/api/milestone-submissions/mine/{id}", id)
                        .header("Authorization", studentBearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void requestChangesIsBlockedWhenMilestoneIsNotOpenEvenBeforeDeadline() throws Exception {
        Instant now = Instant.now();
        UUID actor = UUID.randomUUID();
        Milestone milestone = milestones.saveAndFlush(Milestone.create(MockMilestoneData.TENANT_ID,
                MockMilestoneData.PROJECT_ID, MockMilestoneData.TEAM_ID, "Not open " + UUID.randomUUID(),
                null, now.plusSeconds(3600), true, MockMilestoneData.RUBRIC_ID,
                MockMilestoneData.TECHNICAL_REVIEWER_ID, LatePolicyType.NO_LATE, null, null, actor, now));
        MilestoneSubmission submission = submissions.saveAndFlush(MilestoneSubmission.create(milestone, MockMilestoneData.TEAM_ID,
                "Team", UUID.randomUUID(), "Student", MockMilestoneData.TECHNICAL_REVIEWER_ID, "Reviewer", now));
        SubmissionVersion version = SubmissionVersion.draft(submission, 1, "Work", null, null, actor, now);
        version.submit(now, false, BigDecimal.ZERO);
        versions.saveAndFlush(version);
        submission.submitted(1, now);
        submissions.saveAndFlush(submission);
        JsonNode detail = objectMapper.readTree(mockMvc.perform(get("/api/milestone-submissions/{id}", submission.getId())
                .header("Authorization", bearer())).andExpect(status().isOk())
                .andExpect(jsonPath("$.availableActions.requestChanges").value(false))
                .andReturn().getResponse().getContentAsString());
        long auditCount = audits.count();
        long eventCount = outbox.count();
        mockMvc.perform(post("/api/milestone-submissions/{id}/review", submission.getId())
                .header("Authorization", bearer()).header("Idempotency-Key", "not-open")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reviewRequest(detail, "REQUEST_CHANGES", "Please revise."))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Milestone is not waiting for review"));
        mockMvc.perform(get("/api/milestone-submissions/{id}", submission.getId())
                .header("Authorization", bearer())).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.reviews").isEmpty());
        assertEquals(auditCount, audits.count());
        assertEquals(eventCount, outbox.count());
    }

    @Test
    void reviewerCanRequestChangesAfterDeadlineButStudentCannotSubmitUntilDeadlineIsExtended() throws Exception {
        Instant now = Instant.now();
        UUID actor = UUID.randomUUID();
        Milestone milestone = Milestone.create(MockMilestoneData.TENANT_ID, MockMilestoneData.PROJECT_ID,
                MockMilestoneData.TEAM_ID,
                "Closed request-changes test " + UUID.randomUUID(), null, now.minusSeconds(3600), true,
                MockMilestoneData.RUBRIC_ID, MockMilestoneData.TECHNICAL_REVIEWER_ID,
                LatePolicyType.NO_LATE, null, null, actor, now.minusSeconds(7200));
        milestone.openForWork(actor, now.minusSeconds(7200));
        milestone.start(actor, now.minusSeconds(7100));
        milestone.setExecutionStatus(
                com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.REVIEW,
                actor, now.minusSeconds(600));
        milestone = milestones.saveAndFlush(milestone);
        MilestoneSubmission submission = MilestoneSubmission.create(milestone, MockMilestoneData.TEAM_ID, "Closed Team",
                UUID.randomUUID(), "Student", MockMilestoneData.TECHNICAL_REVIEWER_ID, "Reviewer", now.minusSeconds(1800));
        submission = submissions.saveAndFlush(submission);
        SubmissionVersion version = SubmissionVersion.draft(submission, 1, "Late work", null, null, actor, now.minusSeconds(1200));
        version.submit(now.minusSeconds(600), true, BigDecimal.ZERO);
        versions.saveAndFlush(version);
        submission.submitted(1, now.minusSeconds(600));
        submissions.saveAndFlush(submission);

        String detailJson = mockMvc.perform(get("/api/milestone-submissions/{id}", submission.getId())
                        .header("Authorization", bearer()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode detail = objectMapper.readTree(detailJson);
        mockMvc.perform(post("/api/milestone-submissions/{id}/review", submission.getId())
                        .header("Authorization", bearer())
                        .header("Idempotency-Key", "request-changes-closed")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reviewRequest(detail, "REQUEST_CHANGES", "Please revise."))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CHANGES_REQUESTED"));
        mockMvc.perform(post("/api/milestone-submissions/{id}/versions", submission.getId())
                        .header("Authorization", bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Revision after feedback\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availableActions.submit").value(false));
        mockMvc.perform(post("/api/milestone-submissions/{id}/submit", submission.getId())
                        .header("Authorization", bearer()).header("Idempotency-Key", "expired-revision"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.submission").isArray());
        milestone.extendResubmission(now.plusSeconds(3600), actor, now);
        milestones.saveAndFlush(milestone);
        mockMvc.perform(post("/api/milestone-submissions/{id}/submit", submission.getId())
                        .header("Authorization", bearer()).header("Idempotency-Key", "extended-revision"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.currentVersionNumber").value(2));
    }

    @Test
    void gradeLockAndWaiverDoNotCompleteProjectWithoutAcceptedMilestone() throws Exception {
        Instant now = Instant.now();
        UUID actor = UUID.randomUUID();
        Long projectId = 902L;
        Long teamId = 903L;
        Milestone milestone = Milestone.create(MockMilestoneData.TENANT_ID, projectId, teamId,
                "Mandatory completion gate", null, now.plusSeconds(3600), true,
                MockMilestoneData.RUBRIC_ID, MockMilestoneData.TECHNICAL_REVIEWER_ID,
                LatePolicyType.NO_LATE, null, null, actor, now);
        milestone.openForWork(actor, now);
        milestone = milestones.saveAndFlush(milestone);

        mockMvc.perform(post("/api/projects/{projectId}/teams/{teamId}/final-grade/lock", projectId, teamId)
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"finalScore\":8.25}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.gradeLocked").value(true));

        mockMvc.perform(post("/api/projects/{projectId}/teams/{teamId}/milestones/{milestoneId}/waive",
                                projectId, teamId, milestone.getId())
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Approved curriculum exception\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.gradeLocked").value(true));
    }

    @Test
    void acceptIsIdempotentAndMovesExecutionToDone() throws Exception {
        JsonNode detail = submittedDetail();
        String id = detail.get("id").asText();
        String body = objectMapper.writeValueAsString(reviewRequest(detail, "ACCEPT", ""));

        for (int request = 0; request < 2; request++) {
            mockMvc.perform(post("/api/milestone-submissions/{id}/review", id)
                            .header("Authorization", bearer())
                            .header("Idempotency-Key", "accept-idempotent")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ACCEPTED"))
                    .andExpect(jsonPath("$.executionStatus").value("DONE"));
        }
    }

    @Test
    void returnsNotFoundForDeletedOrUnknownSubmission() throws Exception {
        mockMvc.perform(post("/api/milestone-submissions/{id}/review", UUID.randomUUID())
                        .header("Authorization", bearer())
                        .header("Idempotency-Key", "unknown-submission")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECT\",\"expectedVersion\":0,\"criteria\":[{\"criterionId\":\"00000000-0000-0000-0000-000000000001\",\"ratingLevel\":\"NOT_MET\",\"feedback\":\"Missing\"}]}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    private JsonNode submittedDetail() throws Exception {
        String page = mockMvc.perform(get("/api/milestone-submissions")
                        .header("Authorization", bearer())
                        .param("search", "Core Feature MVP")
                        .param("status", "SUBMITTED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(page).get("content").get(0).get("id").asText();
        String detail = mockMvc.perform(get("/api/milestone-submissions/{id}", id)
                        .header("Authorization", bearer()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(detail);
    }

    private Map<String, Object> reviewRequest(JsonNode detail, String decision, String feedback) {
        List<Map<String, Object>> criteria = new ArrayList<>();
        for (JsonNode criterion : detail.get("rubric").get("criteria")) {
            Map<String, Object> evaluation = new LinkedHashMap<>();
            evaluation.put("criterionId", criterion.get("id").asText());
            evaluation.put("ratingLevel", "GOOD");
            evaluation.put("feedback", feedback);
            criteria.add(evaluation);
        }
        List<Map<String, Object>> checklist = new ArrayList<>();
        for (JsonNode item : detail.get("currentVersion").get("checklist")) {
            checklist.add(Map.of("checklistItemId", item.get("id").asText(), "completed", true));
        }
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("decision", decision);
        request.put("expectedVersion", detail.get("lockVersion").asLong());
        request.put("criteria", criteria);
        request.put("checklist", checklist);
        if ("REQUEST_CHANGES".equals(decision)) request.put("overallFeedback", "Please revise the submission using the criterion feedback.");
        return request;
    }

    private String bearer() {
        var teacher = userDetailsService.loadUserByUsername("teacher@example.com");
        return "Bearer " + tokenService.generateAccessToken(
                new UsernamePasswordAuthenticationToken(teacher, null, teacher.getAuthorities()));
    }

    private String studentBearer() {
        var student = userDetailsService.loadUserByUsername("student@example.com");
        return "Bearer " + tokenService.generateAccessToken(
                new UsernamePasswordAuthenticationToken(student, null, student.getAuthorities()));
    }
}
