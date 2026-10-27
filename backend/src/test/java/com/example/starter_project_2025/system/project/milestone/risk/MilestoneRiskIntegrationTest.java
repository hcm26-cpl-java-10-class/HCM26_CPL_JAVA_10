package com.example.starter_project_2025.system.project.milestone.risk;

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
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.outbox.*;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.alert.*;
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
import org.springframework.boot.test.mock.mockito.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class MilestoneRiskIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired TenantRepository tenants;
    @Autowired ProjectRepository projects;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired TaskRepository tasks;
    @Autowired MilestoneRepository milestones;
    @Autowired TaskAlertProjectLinkRepository projectLinks;
    @Autowired TaskAlertMemberLinkRepository memberLinks;
    @Autowired MilestoneRiskAlertRepository alerts;
    @Autowired MilestoneAuditRepository audit;
    @SpyBean OutboxEventRepository outbox;
    @Autowired UserDetailsService details;
    @Autowired RefreshTokenService tokens;
    @Autowired com.example.starter_project_2025.system.project.task.alert.demo.TaskAlertDemoDataService taskDemo;
    @Autowired com.example.starter_project_2025.system.project.task.alert.demo.TaskAlertDemoDatasetRepository taskDatasets;
    @Autowired com.example.starter_project_2025.system.project.milestone.risk.demo.MilestoneRiskDemoDataService riskDemo;
    @SpyBean(name="milestoneClock") Clock clock;
    final Instant now=Instant.parse("2026-10-25T03:00:00Z");
    UUID projectAlias, memberAlias, milestoneId, firstTask, secondTask;
    Long tenantId,projectId,teamId,mentorId,leaderId,studentId,leftId,teacherMemberId,roleId;
    String mentorToken,leaderToken,studentToken,adminToken;
    long oldAlerts,oldOutbox,oldAudit;

    User user(Tenant tenant, Role role, String first) {
        User row=new User();row.setEmail(UUID.randomUUID()+"@risk.test");row.setFirstName(first);row.setLastName("Test");
        row.setPasswordHash("unused");row.setTenant(tenant);row.setRoles(new HashSet<>(Set.of(role)));return users.saveAndFlush(row);
    }
    String token(User user) {
        var principal=details.loadUserByUsername(user.getEmail());
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()));
    }
    TeamMember member(Team team,User user,ProjectRole role,ParticipationStatus status) {
        TeamMember row=new TeamMember();row.setTeam(team);row.setUser(user);row.setProjectRole(role);row.setParticipationStatus(status);
        return members.saveAndFlush(row);
    }
    Milestone milestone(String title,Instant deadline,boolean open) {
        var row=Milestone
                .create(MilestoneRiskIdentity.tenant(tenantId),projectId,teamId,title,null,deadline,true,UUID.randomUUID(),
                null,LatePolicyType.NO_LATE,null,null,MilestoneRiskIdentity.actor(mentorId),now);
        if(open)row.openForWork(MilestoneRiskIdentity.actor(mentorId),now);
        return milestones.saveAndFlush(row);
    }
    Task task(UUID milestone,TaskStatus status) {
        return tasks.saveAndFlush(Task.builder().projectId(projectAlias).milestoneId(milestone).title("Milestone task")
                .assigneeProjectMemberId(memberAlias).status(status).createdBy(mentorId).updatedBy(mentorId).build());
    }
    @BeforeEach void setup() {
        when(clock.instant()).thenReturn(now);
        tx.executeWithoutResult(status->{
            Tenant tenant=tenants.saveAndFlush(Tenant.builder().code("RISK-"+UUID.randomUUID()).name("Risk tenant").build());tenantId=tenant.getId();
            Role role=new Role();role.setName("RISK-"+UUID.randomUUID());role.setPermissions(new HashSet<>(permissions.findAll()));
            role=roles.saveAndFlush(role);roleId=role.getId();
            User mentor=user(tenant,role,"Mentor");mentorId=mentor.getId();mentorToken=token(mentor);
            User leader=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Leader");leaderId=leader.getId();leaderToken=token(leader);
            User student=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Student");studentId=student.getId();studentToken=token(student);
            User admin=user(tenant,roles.findByName("ADMIN").orElseThrow(),"Admin");adminToken=token(admin);
            User former=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Former");leftId=former.getId();
            User teacher=user(tenant,roles.findByName("TEACHER").orElseThrow(),"Teacher");teacherMemberId=teacher.getId();
            Project project=new Project();project.setCode("RISK-"+UUID.randomUUID());project.setName("Risk project");project.setTenant(tenant);
            project.setStatus(ProjectStatus.ACTIVE);projectId=projects.saveAndFlush(project).getId();
            Team team=new Team();team.setCode("RISK-"+UUID.randomUUID());team.setName("Risk team");team.setProject(project);team.setTenant(tenant);team.setMentor(mentor);
            teamId=teams.saveAndFlush(team).getId();
            member(team,leader,ProjectRole.TEAM_LEADER,ParticipationStatus.ACTIVE);
            var target=member(team,student,ProjectRole.DEV,ParticipationStatus.ACTIVE);
            member(team,former,ProjectRole.DEV,ParticipationStatus.LEFT);
            member(team,teacher,ProjectRole.BA,ParticipationStatus.ACTIVE);
            projectAlias=UUID.randomUUID();memberAlias=UUID.randomUUID();
            var link=new TaskAlertData.ProjectLink();link.setId(projectAlias);link.setProjectId(projectId);link.setTenantId(tenantId);projectLinks.saveAndFlush(link);
            var ml=new TaskAlertData.MemberLink();ml.setId(memberAlias);ml.setProjectId(projectAlias);ml.setSource(TaskAlertData.MemberSource.TEAM_MEMBER);
            ml.setSourceMemberId(target.getId());memberLinks.saveAndFlush(ml);
            milestoneId=milestone("MVP delivery",now.plus(Duration.ofHours(24)),true).getId();
            firstTask=task(milestoneId,TaskStatus.DONE).getId();secondTask=task(milestoneId,TaskStatus.TODO).getId();
        });
        oldAlerts=alerts.count();oldOutbox=outbox.count();oldAudit=audit.count();
    }
    String endpoint() {return "/api/projects/"+projectAlias+"/milestone-risks";}
    String body(String note) throws Exception {
        var map=new LinkedHashMap<String,Object>();map.put("version",milestones.findById(milestoneId).orElseThrow().getVersion());
        if(note!=null)map.put("warningNote",note);return json.writeValueAsString(map);
    }
    ResultActions send(String token,UUID id,String key,String payload) throws Exception {
        var request=post(endpoint()+"/"+id+"/alerts").contentType(MediaType.APPLICATION_JSON).content(payload).header("X-Correlation-ID","risk-test-correlation");
        if(token!=null)request.header("Authorization","Bearer "+token);
        if(key!=null)request.header("Idempotency-Key",key);
        return mvc.perform(request);
    }
    JsonNode result(ResultActions response)throws Exception {return json.readTree(response.andReturn().getResponse().getContentAsString());}
    void unchanged() {
        assertThat(alerts.count()).isEqualTo(oldAlerts);assertThat(outbox.count()).isEqualTo(oldOutbox);assertThat(audit.count()).isEqualTo(oldAudit);
        assertThat(milestones.findById(milestoneId).map(Milestone::isAtRisk).orElse(false)).isFalse();
    }
    @Test void happyPathPersistsFlagOneOutboxAuditAndWholeActiveStudentRoster() throws Exception {
        var response=result(send(mentorToken,milestoneId,UUID.randomUUID().toString(),body("Please review delivery.")).andExpect(status().isAccepted()));
        assertThat(response.get("status").asText()).isEqualTo("PENDING");
        assertThat(response.get("recipientCount").asInt()).isEqualTo(2);
        UUID event=UUID.fromString(response.get("eventId").asText());
        var stored=milestones.findById(milestoneId).orElseThrow();assertThat(stored.isAtRisk()).isTrue();assertThat(stored.getStatus()).isEqualTo(MilestoneStatus.OPEN);
        assertThat(outbox.count()).isEqualTo(oldOutbox+1);assertThat(alerts.count()).isEqualTo(oldAlerts+1);assertThat(audit.count()).isEqualTo(oldAudit+1);
        var payload=json.readTree(outbox.findById(event).orElseThrow().getPayloadJson());
        assertThat(payload.get("event_type").asText()).isEqualTo("MILESTONE_AT_RISK_ALERT_SENT");
        assertThat(java.util.stream.StreamSupport.stream(payload.get("recipient_ids").spliterator(),false).map(JsonNode::asLong))
                .containsExactlyInAnyOrder(studentId,leaderId);
        assertThat(payload.get("recipient_ids")).hasSize(2);
        assertThat(payload.get("channels").toString()).contains("IN_APP","EMAIL");
        assertThat(payload.get("actor_id").asLong()).isEqualTo(mentorId);
        assertThat(payload.get("correlation_id").asText()).isEqualTo("risk-test-correlation");
        var log=audit.findAll().stream().filter(row->row.getMilestoneId().equals(milestoneId)).findFirst().orElseThrow();
        assertThat(log.getCorrelationId()).isEqualTo("risk-test-correlation");assertThat(log.getActorId()).isEqualTo(MilestoneRiskIdentity.actor(mentorId));
        assertThat(tasks.findById(secondTask).orElseThrow().getStatus()).isEqualTo(TaskStatus.TODO);
        assertThat(tasks.findById(secondTask).orElseThrow().getVersion()).isZero();
        mvc.perform(get(endpoint()+"/"+milestoneId+"/alerts").header("Authorization","Bearer "+studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].warningNote").value("Please review delivery."));
    }
    @Test void optionalEmptyAndMissingNotesUseDefaultMessage() throws Exception {
        var response=result(send(mentorToken,milestoneId,UUID.randomUUID().toString(),body(null)).andExpect(status().isAccepted()));
        var alert=alerts.findById(UUID.fromString(response.get("alertId").asText())).orElseThrow();
        assertThat(alert.getWarningNote()).isEqualTo("Milestone MVP delivery is at risk of missing the deadline. Please review your progress.");
        send(mentorToken,milestoneId,UUID.randomUUID().toString(),body("")).andExpect(status().isAccepted());
    }
    @Test void over500Returns422WithoutAnySideEffectsAndExactly500Works() throws Exception {
        send(mentorToken,milestoneId,UUID.randomUUID().toString(),body("x".repeat(520))).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.warningNote[0]").value("Guidance note cannot exceed 500 characters"));unchanged();
        send(mentorToken,milestoneId,UUID.randomUUID().toString(),body("x".repeat(500))).andExpect(status().isAccepted());
    }
    @ParameterizedTest @ValueSource(strings={"HARD","SOFT","MOVED","TENANT"})
    void removedOrMovedMilestoneReturns404(String change)throws Exception {
        String payload=body("Keep my draft");
        tx.executeWithoutResult(status->{
            var row=milestones.findById(milestoneId).orElseThrow();
            switch(change){
                case "HARD"->milestones.delete(row);
                case "SOFT"->row.softDelete(MilestoneRiskIdentity.actor(mentorId),now);
                case "MOVED"->jdbc.update("update milestones set project_id=? where milestone_id=?",UUID.randomUUID(),milestoneId);
                default->jdbc.update("update milestones set tenant_id=? where milestone_id=?",UUID.randomUUID(),milestoneId);
            }
        });
        send(mentorToken,milestoneId,UUID.randomUUID().toString(),payload).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Milestone does not exist or has been changed"));
        assertThat(alerts.count()).isEqualTo(oldAlerts);assertThat(outbox.count()).isEqualTo(oldOutbox);assertThat(audit.count()).isEqualTo(oldAudit);
    }
    @Test void unknownIdIs404ButForeignProjectScopeIs403AndNoDataLeaks()throws Exception {
        send(mentorToken,UUID.randomUUID(),UUID.randomUUID().toString(),body("Reminder")).andExpect(status().isNotFound());
        mvc.perform(get("/api/projects/"+UUID.randomUUID()+"/milestone-risks").header("Authorization","Bearer "+mentorToken))
                .andExpect(status().isForbidden()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("MVP delivery"))));
        unchanged();
    }
    @Test void authenticationAndActualTeamRoleAreRequired()throws Exception {
        String payload=body("Reminder");
        send(null,milestoneId,UUID.randomUUID().toString(),payload).andExpect(status().isUnauthorized());
        send("invalid-token",milestoneId,UUID.randomUUID().toString(),payload).andExpect(status().isUnauthorized());
        send(studentToken,milestoneId,UUID.randomUUID().toString(),payload).andExpect(status().isForbidden());unchanged();
        send(leaderToken,milestoneId,UUID.randomUUID().toString(),payload).andExpect(status().isAccepted());
        send(adminToken,milestoneId,UUID.randomUUID().toString(),body("Admin reminder")).andExpect(status().isAccepted());
    }
    @Test void retryAndTwoConcurrentRequestsCreateOneEvent()throws Exception {
        String key=UUID.randomUUID().toString(),payload=body("Parallel warning");var start=new CountDownLatch(1);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
            Callable<JsonNode> call=()->{start.await();return result(send(mentorToken,milestoneId,key,payload).andExpect(status().isAccepted()));};
            var a=pool.submit(call);var b=pool.submit(call);start.countDown();assertThat(a.get(15,TimeUnit.SECONDS).get("alertId")).isEqualTo(b.get(15,TimeUnit.SECONDS).get("alertId"));
        }
        assertThat(outbox.count()).isEqualTo(oldOutbox+1);assertThat(audit.count()).isEqualTo(oldAudit+1);
        send(mentorToken,milestoneId,key,payload).andExpect(status().isAccepted());
        send(mentorToken,milestoneId,key,body("Different note")).andExpect(status().isConflict());
        assertThat(outbox.count()).isEqualTo(oldOutbox+1);
    }
    @Test void progressIsRecheckedAndConfigurationsReturn409RatherThan404()throws Exception {
        String payload=body("Reminder");
        tx.executeWithoutResult(status->tasks.findById(secondTask).orElseThrow().setStatus(TaskStatus.DONE));
        send(mentorToken,milestoneId,UUID.randomUUID().toString(),payload).andExpect(status().isConflict());unchanged();
        tx.executeWithoutResult(status->ReflectionTestUtils.setField(milestones.findById(milestoneId).orElseThrow(),"deadline",now.plus(Duration.ofHours(72))));
        send(mentorToken,milestoneId,UUID.randomUUID().toString(),payload).andExpect(status().isConflict());unchanged();
    }
    @Test void listHonorsExactTimeAndCompletionBoundariesAndIgnoresDeletedTasks()throws Exception {
        tx.executeWithoutResult(status->{
            milestone("Zero tasks",now.plus(Duration.ofHours(1)),true);
            milestone("At 48 hours",now.plus(Duration.ofHours(48)),true);
            milestone("At deadline",now,true);milestone("Overdue",now.minusSeconds(1),true);
            milestone("Planned",now.plusSeconds(60),false);
            var eighty=milestone("Exactly eighty",now.plusSeconds(3600),true);
            for(int i=0;i<5;i++)task(eighty.getId(),i<4?TaskStatus.DONE:TaskStatus.TODO);
            task(eighty.getId(),TaskStatus.TODO).setIsActive(false);
            var hidden=milestone("Deleted milestone",now.plusSeconds(60),true);hidden.softDelete(MilestoneRiskIdentity.actor(mentorId),now);
        });
        mvc.perform(get(endpoint()).header("Authorization","Bearer "+studentToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2)).andExpect(jsonPath("$.canSend").value(false));
        var response=result(mvc.perform(get(endpoint()).param("atRiskOnly","false").header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk()));
        var eighty=java.util.stream.StreamSupport.stream(response.get("content").spliterator(),false)
                .filter(row->row.get("title").asText().equals("Exactly eighty")).findFirst().orElseThrow();
        assertThat(eighty.at("/progress/totalTasks").asInt()).isEqualTo(5);
        assertThat(eighty.at("/progress/completionRate").asDouble()).isEqualTo(80);
        assertThat(eighty.at("/progress/eligible").asBoolean()).isFalse();unchanged();
    }
    @Test void zeroTaskMilestoneCanBeAlerted()throws Exception {
        UUID empty=tx.execute(status->milestone("Unplanned work",now.plusSeconds(3600),true).getId());
        send(mentorToken,empty,UUID.randomUUID().toString(),"{\"version\":0}").andExpect(status().isAccepted());
    }
    @Test void changedPermissionsAssignmentsAndInactiveTenantApplyToExistingToken()throws Exception {
        tx.executeWithoutResult(status->roles.findById(roleId).orElseThrow().getPermissions().removeIf(permission->permission.getName().equals("MILESTONE_ALERT_SEND")));
        send(mentorToken,milestoneId,UUID.randomUUID().toString(),body("Reminder")).andExpect(status().isForbidden());
        tx.executeWithoutResult(status->{roles.findById(roleId).orElseThrow().getPermissions().add(permissions.findByName("MILESTONE_ALERT_SEND").orElseThrow());teams.findById(teamId).orElseThrow().setMentor(null);});
        send(mentorToken,milestoneId,UUID.randomUUID().toString(),body("Reminder")).andExpect(status().isForbidden());
        tx.executeWithoutResult(status->tenants.findById(tenantId).orElseThrow().setActive(false));
        send(adminToken,milestoneId,UUID.randomUUID().toString(),body("Reminder")).andExpect(status().isForbidden());unchanged();
    }
    @Test void noRecipientsIs409AndFailedOutboxRollsBackFlagAuditAndAlert()throws Exception {
        doThrow(new IllegalStateException("simulated persistence failure")).when(outbox).saveAndFlush(any(OutboxEvent.class));
        try {send(mentorToken,milestoneId,UUID.randomUUID().toString(),body("Reminder")).andExpect(status().isInternalServerError());}
        finally{reset(outbox);}
        unchanged();
        tx.executeWithoutResult(status->members.findManagedRoster(teamId).forEach(row->row.setParticipationStatus(ParticipationStatus.LEFT)));
        send(mentorToken,milestoneId,UUID.randomUUID().toString(),body("Reminder")).andExpect(status().isConflict());unchanged();
    }
    @Test @org.springframework.transaction.annotation.Transactional
    void localRiskFixturesSeedSixCasesOnceWithoutResettingEditedMilestones() throws Exception {
        taskDemo.seed();riskDemo.seed();
        var admin=users.findByEmail("admin@example.com").orElseThrow();
        var project=1L;
        var rows=milestones.findByProjectIdAndTenantIdAndActiveTrueOrderByDeadlineAscIdAsc(project,MilestoneRiskIdentity.tenant(admin.getTenant().getId()));
        assertThat(rows).hasSize(6);
        var teacher=users.findByEmail("teacher@example.com").orElseThrow();
        mvc.perform(get("/api/projects/"+project+"/milestone-risks").header("Authorization","Bearer "+token(teacher)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(2));
        rows.getFirst().softDelete(MilestoneRiskIdentity.actor(admin.getId()),now);milestones.flush();
        long count=milestones.count(),taskCount=tasks.count(),userCount=users.count();
        riskDemo.seed();
        assertThat(milestones.count()).isEqualTo(count);assertThat(tasks.count()).isEqualTo(taskCount);assertThat(users.count()).isEqualTo(userCount);
        assertThat(milestones.findById(rows.getFirst().getId()).orElseThrow().isActive()).isFalse();
    }
}
