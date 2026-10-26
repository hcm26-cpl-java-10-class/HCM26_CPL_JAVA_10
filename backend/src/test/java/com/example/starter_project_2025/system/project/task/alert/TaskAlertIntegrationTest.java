package com.example.starter_project_2025.system.project.task.alert;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.team.ParticipationStatus;
import com.example.starter_project_2025.system.project.team.ProjectRole;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.team.TeamMember;
import com.example.starter_project_2025.system.project.team.TeamMemberRepository;
import com.example.starter_project_2025.system.project.team.TeamRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.rbac.user.*;
import com.example.starter_project_2025.system.rbac.role.*;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class TaskAlertIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @Autowired TenantRepository tenants;
    @Autowired ProjectRepository projects;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository members;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired TaskRepository tasks;
    @Autowired TaskAlertProjectLinkRepository projectLinks;
    @Autowired TaskAlertMemberLinkRepository memberLinks;
    @Autowired TaskAlertBatchRepository batches;
    @org.springframework.boot.test.mock.mockito.SpyBean TaskAlertOutboxRepository outbox;
    @Autowired TaskAlertItemRepository items;
    @Autowired com.example.starter_project_2025.system.project.task.alert.demo.TaskAlertDemoDataService demo;
    @Autowired com.example.starter_project_2025.system.project.task.alert.demo.TaskAlertDemoDatasetRepository demoDatasets;
    @Autowired UserDetailsService details;
    @Autowired RefreshTokenService tokens;
    @MockBean(name = "taskAlertClock") Clock clock;
    final Instant now = Instant.parse("2026-10-25T03:00:00Z");
    UUID projectAlias, memberAlias, first, second;
    Long tenantId, projectId, teamId, mentorId, leaderId, assigneeId, adminId, roleId;
    String mentorToken, leaderToken, assigneeToken, adminToken;
    long oldBatches, oldEvents, oldItems, oldAudits;

    User user(Tenant tenant, Role role, String name) {
        User user = new User(); user.setEmail(UUID.randomUUID() + "@alert.test"); user.setFirstName(name); user.setLastName("Test");
        user.setPasswordHash("unused"); user.setTenant(tenant); user.setRoles(new HashSet<>(Set.of(role)));
        return users.saveAndFlush(user);
    }
    String token(User user) {
        var principal = details.loadUserByUsername(user.getEmail());
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
    Task task(UUID project, UUID assignee, TaskStatus status, Instant deadline) {
        Task value = Task.builder().projectId(project).assigneeProjectMemberId(assignee).title("Overdue work")
                .status(status).deadline(deadline).createdBy(mentorId).updatedBy(mentorId).build();
        return tasks.saveAndFlush(value);
    }
    @BeforeEach void setup() {
        when(clock.instant()).thenReturn(now);
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("ALERT-" + UUID.randomUUID()).name("Alert tenant").build());
            tenantId = tenant.getId();
            Role mentorRole = new Role(); mentorRole.setName("ALERT-" + UUID.randomUUID());
            mentorRole.setPermissions(new HashSet<>(permissions.findAll())); roleId = roles.saveAndFlush(mentorRole).getId();
            User mentor = user(tenant, mentorRole, "Mentor"); mentorId = mentor.getId(); mentorToken = token(mentor);
            User leader = user(tenant, roles.findByName("STUDENT").orElseThrow(), "Leader"); leaderId = leader.getId(); leaderToken = token(leader);
            User assignee = user(tenant, roles.findByName("STUDENT").orElseThrow(), "Assignee"); assigneeId = assignee.getId(); assigneeToken = token(assignee);
            User admin = user(tenant, roles.findByName("ADMIN").orElseThrow(), "Admin"); adminId = admin.getId(); adminToken = token(admin);
            Project project = new Project(); project.setCode("ALERT-" + UUID.randomUUID()); project.setName("Alert project");
            project.setTenant(tenant); project.setStatus(ProjectStatus.ACTIVE); projectId = projects.saveAndFlush(project).getId();
            Team team = new Team(); team.setCode("ALERT-" + UUID.randomUUID()); team.setName("Alert team");
            team.setTenant(tenant); team.setProject(project); team.setMentor(mentor); teamId = teams.saveAndFlush(team).getId();
            TeamMember lead = new TeamMember(); lead.setTeam(team); lead.setUser(leader); lead.setProjectRole(ProjectRole.TEAM_LEADER); members.saveAndFlush(lead);
            TeamMember member = new TeamMember(); member.setTeam(team); member.setUser(assignee); member = members.saveAndFlush(member);
            projectAlias = UUID.randomUUID(); memberAlias = UUID.randomUUID();
            var projectLink = new TaskAlertData.ProjectLink(); projectLink.setId(projectAlias); projectLink.setProjectId(projectId); projectLink.setTenantId(tenantId); projectLinks.saveAndFlush(projectLink);
            var memberLink = new TaskAlertData.MemberLink(); memberLink.setId(memberAlias); memberLink.setProjectId(projectAlias);
            memberLink.setSource(TaskAlertData.MemberSource.TEAM_MEMBER); memberLink.setSourceMemberId(member.getId()); memberLinks.saveAndFlush(memberLink);
            first = task(projectAlias, memberAlias, TaskStatus.TODO, now.minusSeconds(60)).getId();
            second = task(projectAlias, memberAlias, TaskStatus.IN_PROGRESS, now.minusSeconds(120)).getId();
        });
        oldBatches = batches.count(); oldEvents = outbox.count(); oldItems = items.count();
        oldAudits = jdbc.queryForObject("select count(*) from task_audit_log", Long.class);
    }
    String body(String note) throws Exception {
        var selections = List.of(first, second).stream().map(id -> new TaskAlertDtos.Selection(id,
                tasks.findById(id).orElseThrow().getVersion())).toList();
        return json.writeValueAsString(new TaskAlertDtos.Send(projectAlias, selections, note));
    }
    ResultActions send(String token, String key, String body) throws Exception {
        var request = post("/api/task-alerts").contentType(MediaType.APPLICATION_JSON).content(body)
                .header("X-Correlation-ID", "alert-test-correlation");
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (key != null) request.header("Idempotency-Key", key);
        return mvc.perform(request);
    }
    JsonNode result(ResultActions response) throws Exception {
        return json.readTree(response.andReturn().getResponse().getContentAsString());
    }
    void unchanged() {
        assertThat(batches.count()).isEqualTo(oldBatches);
        assertThat(outbox.count()).isEqualTo(oldEvents);
        assertThat(items.count()).isEqualTo(oldItems);
        assertThat(jdbc.queryForObject("select count(*) from task_audit_log", Long.class)).isEqualTo(oldAudits);
    }

    @Test void ac01OneBatchOutboxAndTwoAuditsDeduplicateRecipientsAndKeepTasksUnchanged() throws Exception {
        String payload = body("Please prioritize this work.");
        var response = result(send(mentorToken, UUID.randomUUID().toString(), payload).andExpect(status().isAccepted()));
        assertThat(response.get("status").asText()).isEqualTo("PENDING");
        assertThat(response.get("taskCount").asInt()).isEqualTo(2);
        assertThat(response.get("recipientCount").asInt()).isEqualTo(1);
        UUID batchId = UUID.fromString(response.get("batchId").asText());
        tx.executeWithoutResult(status -> {
            var event = outbox.findByBatchId(batchId).orElseThrow();
            assertThat(event.getEventType()).isEqualTo("TASK_OVERDUE_ALERT_BATCH_SENT");
            assertThat(event.getDeliveredAt()).isNull();
            try {
                var contents = json.readTree(event.getPayload());
                assertThat(contents.get("task_ids")).hasSize(2);
                assertThat(contents.get("assignee_ids")).hasSize(1);
                assertThat(contents.get("recipients")).hasSize(1);
                assertThat(contents.at("/recipients/0/user_id").asLong()).isEqualTo(assigneeId);
                assertThat(contents.at("/recipients/0/task_ids")).hasSize(2);
                assertThat(contents.get("channels").toString()).contains("IN_APP", "EMAIL");
                assertThat(contents.get("correlation_id").asText()).isEqualTo("alert-test-correlation");
                assertThat(contents.has("password")).isFalse();
            } catch (Exception exception) { throw new AssertionError(exception); }
        });
        assertThat(outbox.count()).isEqualTo(oldEvents + 1);
        assertThat(batches.count()).isEqualTo(oldBatches + 1);
        assertThat(items.count()).isEqualTo(oldItems + 2);
        assertThat(jdbc.queryForObject("select count(*) from task_audit_log", Long.class)).isEqualTo(oldAudits + 2);
        assertThat(tasks.findById(first).orElseThrow().getStatus()).isEqualTo(TaskStatus.TODO);
        assertThat(tasks.findById(first).orElseThrow().getVersion()).isZero();
        mvc.perform(get("/api/task-alerts/tasks/" + first + "/history").header("Authorization", "Bearer " + mentorToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].warningNote").value("Please prioritize this work."))
                .andExpect(jsonPath("$[0].status").value("PENDING"));
    }
    @Test void ac02Over500Is422AndExactly500IsAccepted() throws Exception {
        send(mentorToken, UUID.randomUUID().toString(), body("x".repeat(520))).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.warningNote[0]").value("Warning note cannot exceed 500 characters"));
        unchanged();
        send(mentorToken, UUID.randomUUID().toString(), body("x".repeat(500))).andExpect(status().isAccepted());
    }
    @Test void blankNoteAndMissingKeyAreRejectedWithoutSideEffects() throws Exception {
        send(mentorToken, UUID.randomUUID().toString(), body("   ")).andExpect(status().isUnprocessableEntity());
        send(mentorToken, null, body("Reminder")).andExpect(status().isUnprocessableEntity());
        unchanged();
    }
    @ParameterizedTest @ValueSource(strings = {"DONE", "FUTURE", "UNASSIGNED", "STALE", "REVIEW", "BLOCKED"})
    void ac03OneInvalidTaskRollsBackWholeBatch(String change) throws Exception {
        String payload = body("Keep this note.");
        tx.executeWithoutResult(status -> {
            Task task = tasks.findById(second).orElseThrow();
            switch (change) {
                case "DONE" -> task.setStatus(TaskStatus.DONE);
                case "FUTURE" -> task.setDeadline(now.plusSeconds(60));
                case "UNASSIGNED" -> task.setAssigneeProjectMemberId(null);
                case "REVIEW" -> task.setStatus(TaskStatus.REVIEW);
                case "BLOCKED" -> task.setStatus(TaskStatus.BLOCKED);
                default -> task.setTitle("Changed after the dialog opened");
            }
        });
        send(mentorToken, UUID.randomUUID().toString(), payload).andExpect(status().isConflict());
        unchanged();
    }
    @Test void retriesUseTheSameBatchEvenAfterTheTaskLaterFinishes() throws Exception {
        String key = UUID.randomUUID().toString(), payload = body("Reminder");
        var firstResponse = result(send(mentorToken, key, payload).andExpect(status().isAccepted()));
        tx.executeWithoutResult(status -> tasks.findById(first).orElseThrow().setStatus(TaskStatus.DONE));
        var secondResponse = result(send(mentorToken, key, payload).andExpect(status().isAccepted()));
        assertThat(secondResponse.get("batchId")).isEqualTo(firstResponse.get("batchId"));
        assertThat(outbox.count()).isEqualTo(oldEvents + 1);
        assertThat(batches.count()).isEqualTo(oldBatches + 1);
    }
    @Test void sameKeyDifferentNoteReturns409() throws Exception {
        String key = UUID.randomUUID().toString();
        send(mentorToken, key, body("First reminder")).andExpect(status().isAccepted());
        send(mentorToken, key, body("A different reminder")).andExpect(status().isConflict());
        assertThat(outbox.count()).isEqualTo(oldEvents + 1);
    }
    @Test void twoConcurrentRetriesQueueOnlyOneEvent() throws Exception {
        String payload = body("Parallel reminder"), key = UUID.randomUUID().toString();
        var start = new CountDownLatch(1);
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            Callable<JsonNode> call = () -> { start.await(); return result(send(mentorToken, key, payload).andExpect(status().isAccepted())); };
            var a = pool.submit(call); var b = pool.submit(call); start.countDown();
            assertThat(a.get(15, TimeUnit.SECONDS).get("batchId")).isEqualTo(b.get(15, TimeUnit.SECONDS).get("batchId"));
        }
        assertThat(outbox.count()).isEqualTo(oldEvents + 1);
        assertThat(batches.count()).isEqualTo(oldBatches + 1);
    }
    @Test void ac04Anonymous401AndOrdinaryTeamMember403() throws Exception {
        send(null, UUID.randomUUID().toString(), body("Reminder")).andExpect(status().isUnauthorized());
        send("invalid-token", UUID.randomUUID().toString(), body("Reminder")).andExpect(status().isUnauthorized());
        send(assigneeToken, UUID.randomUUID().toString(), body("Reminder")).andExpect(status().isForbidden());
        unchanged();
    }
    @Test void projectTeamLeaderAndAdminCanSend() throws Exception {
        send(leaderToken, UUID.randomUUID().toString(), body("Leader reminder")).andExpect(status().isAccepted());
        send(adminToken, UUID.randomUUID().toString(), body("Admin reminder")).andExpect(status().isAccepted());
        assertThat(outbox.count()).isEqualTo(oldEvents + 2);
    }
    @Test void leaderGetsBatchConflictWhenAssigneeLeavesAfterSelection() throws Exception {
        String payload = body("Keep this reminder.");
        tx.executeWithoutResult(status -> members.findByTeamIdAndUserId(teamId, assigneeId)
                .orElseThrow().setParticipationStatus(ParticipationStatus.LEFT));
        send(leaderToken, UUID.randomUUID().toString(), payload).andExpect(status().isConflict());
        unchanged();
    }
    @Test void revokedAssignmentAndPermissionApplyToTheSameToken() throws Exception {
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().getPermissions()
                .removeIf(permission -> permission.getName().equals("TASK_ALERT_SEND")));
        send(mentorToken, UUID.randomUUID().toString(), body("Reminder")).andExpect(status().isForbidden());
        tx.executeWithoutResult(status -> {
            roles.findById(roleId).orElseThrow().getPermissions().add(permissions.findByName("TASK_ALERT_SEND").orElseThrow());
            teams.findById(teamId).orElseThrow().setMentor(null);
        });
        send(mentorToken, UUID.randomUUID().toString(), body("Reminder")).andExpect(status().isForbidden());
        unchanged();
    }
    @Test void inactiveTenantAndUnknownProjectDoNotLeakTaskData() throws Exception {
        var bad = new TaskAlertDtos.Send(UUID.randomUUID(), List.of(new TaskAlertDtos.Selection(first, 0L)), "Reminder");
        send(mentorToken, UUID.randomUUID().toString(), json.writeValueAsString(bad)).andExpect(status().isForbidden());
        tx.executeWithoutResult(status -> tenants.findById(tenantId).orElseThrow().setActive(false));
        send(mentorToken, UUID.randomUUID().toString(), body("Reminder")).andExpect(status().isForbidden());
        unchanged();
    }
    @Test void overdueUsesStrictServerDeadlineAndOnlyTodoOrInProgress() throws Exception {
        tx.executeWithoutResult(status -> {
            task(projectAlias, memberAlias, TaskStatus.TODO, now);
            task(projectAlias, memberAlias, TaskStatus.TODO, null);
            task(projectAlias, memberAlias, TaskStatus.TODO, now.plusSeconds(1));
            task(projectAlias, memberAlias, TaskStatus.REVIEW, now.minusSeconds(1));
            task(projectAlias, memberAlias, TaskStatus.BLOCKED, now.minusSeconds(1));
            task(projectAlias, memberAlias, TaskStatus.DONE, now.minusSeconds(1));
        });
        mvc.perform(get("/api/task-alerts/overdue").param("projectId", projectAlias.toString())
                .header("Authorization", "Bearer " + mentorToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.canSend").value(true));
        unchanged();
    }
    @Test void bridgeSetupIsAdminOnlyAndAliasesCannotBeReassigned() throws Exception {
        String url = "/api/task-alerts/project-links/" + projectAlias;
        mvc.perform(put(url).header("Authorization", "Bearer " + mentorToken).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectId", projectId)))).andExpect(status().isForbidden());
        mvc.perform(put(url).header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectId", projectId)))).andExpect(status().isOk());
        mvc.perform(get("/api/task-alerts/bridge-options").header("Authorization", "Bearer " + adminToken)).andExpect(status().isOk());
        unchanged();
    }
    @Test void actualAssigneeWorkflowFinishesTaskBeforeTheAlertAndReturns409() throws Exception {
        String payload = body("Prepared before the assignee finished");
        for (TaskStatus next : List.of(TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.DONE)) {
            Long version = tasks.findById(first).orElseThrow().getVersion();
            mvc.perform(patch("/api/tasks/" + first + "/status")
                    .header("Authorization", "Bearer " + assigneeToken)
                    .header("Idempotency-Key", UUID.randomUUID().toString())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("status", next, "version", version))))
                    .andExpect(status().isOk());
        }
        oldAudits = jdbc.queryForObject("select count(*) from task_audit_log", Long.class);
        send(mentorToken, UUID.randomUUID().toString(), payload).andExpect(status().isConflict());
        unchanged();
    }
    @Test void persistenceFailureRollsBackBatchItemsAndAuditTogether() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalStateException("Simulated outbox failure"))
                .when(outbox).saveAndFlush(org.mockito.ArgumentMatchers.any(TaskAlertData.Outbox.class));
        try { send(mentorToken, UUID.randomUUID().toString(), body("Rollback test")).andExpect(status().isInternalServerError()); }
        finally { org.mockito.Mockito.reset(outbox); }
        unchanged();
    }
    @Test @org.springframework.transaction.annotation.Transactional
    void localDemoSeedsSevenTasksOnceAndPreservesEditedTasksAndRoster() {
        demo.seed();
        var admin = users.findByEmail("admin@example.com").orElseThrow();
        var dataset = demoDatasets.findById(admin.getTenant().getId()).orElseThrow();
        var fixtureTasks = tasks.findAll().stream().filter(task -> dataset.getTaskProjectId().equals(task.getProjectId())).toList();
        assertThat(fixtureTasks).hasSize(7);
        assertThat(fixtureTasks.stream().filter(task -> task.getDeadline() != null && task.getDeadline().isBefore(Instant.now())
                && Set.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS).contains(task.getStatus()))).hasSize(3);
        var target = fixtureTasks.stream().filter(task -> "Implement booking API".equals(task.getTitle())).findFirst().orElseThrow();
        var linkedMember = memberLinks.findById(target.getAssigneeProjectMemberId()).orElseThrow();
        var member = members.findById(linkedMember.getSourceMemberId()).orElseThrow();
        assertThat(member.getUser().getEmail()).isEqualTo("student@example.com");
        target.setStatus(TaskStatus.DONE); target.setTitle("An edited demo task"); target.setDeadline(Instant.EPOCH);
        member.setParticipationStatus(ParticipationStatus.LEFT);
        tasks.flush(); members.flush();
        long userCount = users.count(), taskCount = tasks.count(), eventCount = outbox.count();
        demo.seed();
        assertThat(tasks.count()).isEqualTo(taskCount);
        assertThat(users.count()).isEqualTo(userCount);
        assertThat(outbox.count()).isEqualTo(eventCount);
        assertThat(tasks.findById(target.getId()).orElseThrow().getTitle()).isEqualTo("An edited demo task");
        assertThat(tasks.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(TaskStatus.DONE);
        assertThat(tasks.findById(target.getId()).orElseThrow().getDeadline()).isEqualTo(Instant.EPOCH);
        assertThat(members.findById(member.getId()).orElseThrow().getParticipationStatus()).isEqualTo(ParticipationStatus.LEFT);
    }
    @Test void projectDropdownUsesCurrentScopeAndDoesNotExposeOtherProjects() throws Exception {
        mvc.perform(get("/api/task-alerts/projects")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/task-alerts/projects").header("Authorization", "Bearer " + mentorToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(projectAlias.toString()))
                .andExpect(jsonPath("$[0].name").value("Alert project"));
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setMentor(null));
        mvc.perform(get("/api/task-alerts/projects").header("Authorization", "Bearer " + mentorToken))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/task-alerts/projects").header("Authorization", "Bearer " + assigneeToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(projectAlias.toString()));
        unchanged();
    }
    @Test void unmappedLegacyTaskCrudStillWorksButCannotSendAlerts() throws Exception {
        UUID legacyProject = UUID.randomUUID();
        var response = mvc.perform(post("/api/tasks").header("Authorization", "Bearer " + mentorToken)
                .header("Idempotency-Key", UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectId", legacyProject, "title", "Legacy task",
                        "priority", "MEDIUM", "tags", List.of(), "deadline", now.minusSeconds(1).toString()))))
                .andExpect(status().isOk()).andReturn();
        var saved = json.readTree(response.getResponse().getContentAsString());
        assertThat(Instant.parse(saved.get("deadline").asText())).isEqualTo(now.minusSeconds(1));
        mvc.perform(get("/api/tasks/" + saved.get("id").asText()).header("Authorization", "Bearer " + mentorToken))
                .andExpect(status().isOk());
        var request = new TaskAlertDtos.Send(legacyProject,
                List.of(new TaskAlertDtos.Selection(UUID.fromString(saved.get("id").asText()), saved.get("version").asLong())), "Reminder");
        send(mentorToken, UUID.randomUUID().toString(), json.writeValueAsString(request)).andExpect(status().isForbidden());
        assertThat(outbox.count()).isEqualTo(oldEvents);
    }
}
