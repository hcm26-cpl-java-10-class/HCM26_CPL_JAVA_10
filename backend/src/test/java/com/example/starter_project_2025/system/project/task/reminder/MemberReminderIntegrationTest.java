package com.example.starter_project_2025.system.project.task.reminder;

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
import com.example.starter_project_2025.system.project.task.audit.*;
import com.example.starter_project_2025.system.project.task.alert.*;
import com.example.starter_project_2025.system.project.milestone.outbox.*;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class MemberReminderIntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired TransactionTemplate tx; @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users; @Autowired RoleRepository roles; @Autowired PermissionRepository permissions;
    @Autowired TenantRepository tenants; @Autowired ProjectRepository projects; @Autowired TeamRepository teams; @Autowired TeamMemberRepository memberships;
    @Autowired TaskRepository tasks; @Autowired TaskAuditRepository taskAudits; @Autowired TaskAuditService taskAudit;
    @Autowired TaskAlertProjectLinkRepository projectLinks; @Autowired TaskAlertMemberLinkRepository memberLinks;
    @Autowired MemberReminderBatchRepository batches; @Autowired MemberReminderItemRepository items; @Autowired MemberReminderAuditRepository audits;
    @Autowired MemberReminderDemoDataService demo; @Autowired MemberReminderDemoDatasetRepository datasets;
    @SpyBean OutboxEventRepository outbox;
    @MockBean(name="memberReminderClock") Clock clock;
    @MockBean MemberContributionPort external;
    @Autowired UserDetailsService details; @Autowired RefreshTokenService tokens;
    Instant now; UUID projectAlias,memberAlias,taskId; Long tenantId,teamId,mentorId,leaderId,aId,bId,roleId;
    String mentorToken,leaderToken,aToken,adminToken; long oldBatches,oldItems,oldOutbox,oldAudits;
    User user(Tenant tenant,Role role,String name){
        User user=new User();user.setEmail(UUID.randomUUID()+"@reminder.test");user.setFirstName(name);user.setLastName("Test");
        user.setUserCode("U-"+UUID.randomUUID());user.setPasswordHash("unused");user.setTenant(tenant);user.setRoles(new HashSet<>(Set.of(role)));return users.saveAndFlush(user);
    }
    String token(User user){var principal=details.loadUserByUsername(user.getEmail());return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()));}
    TeamMember member(Team team,User user,ProjectRole role,Instant joined){
        TeamMember row=new TeamMember();row.setTeam(team);row.setUser(user);row.setProjectRole(role);row.setJoinedAt(joined);return memberships.saveAndFlush(row);
    }
    @BeforeEach void setup(){
        now=Instant.now().truncatedTo(ChronoUnit.SECONDS).plusSeconds(30);
        when(clock.instant()).thenReturn(now);when(external.latest(any(),anySet(),any())).thenReturn(Map.of());
        tx.executeWithoutResult(status->{
            Tenant tenant=tenants.saveAndFlush(Tenant.builder().code("REM-"+UUID.randomUUID()).name("Reminder tenant").build());tenantId=tenant.getId();
            Role role=new Role();role.setName("REM-"+UUID.randomUUID());role.setPermissions(new HashSet<>(permissions.findAll()));role=roles.saveAndFlush(role);roleId=role.getId();
            User mentor=user(tenant,role,"Mentor");mentorId=mentor.getId();mentorToken=token(mentor);
            User leader=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Leader");leaderId=leader.getId();leaderToken=token(leader);
            User a=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Member A");aId=a.getId();aToken=token(a);
            User b=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Member B");bId=b.getId();
            User admin=user(tenant,roles.findByName("ADMIN").orElseThrow(),"Admin");adminToken=token(admin);
            Project project=new Project();project.setCode("REM-"+UUID.randomUUID());project.setName("Reminder project");project.setTenant(tenant);project.setStatus(ProjectStatus.ACTIVE);projects.saveAndFlush(project);
            Team team=new Team();team.setCode("REM-"+UUID.randomUUID());team.setName("Reminder team");team.setProject(project);team.setTenant(tenant);team.setMentor(mentor);teamId=teams.saveAndFlush(team).getId();
            member(team,leader,ProjectRole.TEAM_LEADER,now.minus(Duration.ofDays(1)));
            var target=member(team,a,ProjectRole.DEV,now.minus(Duration.ofDays(8)));
            member(team,b,ProjectRole.DEV,now.minus(Duration.ofDays(9)));
            projectAlias=UUID.randomUUID();memberAlias=UUID.randomUUID();
            var link=new TaskAlertData.ProjectLink();link.setId(projectAlias);link.setProjectId(project.getId());link.setTenantId(tenantId);projectLinks.saveAndFlush(link);
            var ml=new TaskAlertData.MemberLink();ml.setId(memberAlias);ml.setProjectId(projectAlias);ml.setSource(TaskAlertData.MemberSource.TEAM_MEMBER);ml.setSourceMemberId(target.getId());memberLinks.saveAndFlush(ml);
            taskId=tasks.saveAndFlush(Task.builder().projectId(projectAlias).assigneeProjectMemberId(memberAlias).title("Resume work").status(TaskStatus.TODO).createdBy(mentorId).updatedBy(mentorId).build()).getId();
        });
        oldBatches=batches.count();oldItems=items.count();oldOutbox=outbox.count();oldAudits=audits.count();
    }
    String endpoint(){return "/api/projects/"+projectAlias+"/inactive-members";}
    String body(String note,Long... ids)throws Exception{return json.writeValueAsString(new MemberReminderDtos.Send(List.of(ids),note));}
    ResultActions send(String token,String key,String payload)throws Exception{
        var request=post(endpoint()+"/reminders").contentType(MediaType.APPLICATION_JSON).content(payload).header("X-Correlation-ID","member-reminder-test");
        if(token!=null)request.header("Authorization","Bearer "+token);if(key!=null)request.header("Idempotency-Key",key);return mvc.perform(request);
    }
    JsonNode result(ResultActions result)throws Exception{return json.readTree(result.andReturn().getResponse().getContentAsString());}
    void unchanged(){assertThat(batches.count()).isEqualTo(oldBatches);assertThat(items.count()).isEqualTo(oldItems);assertThat(outbox.count()).isEqualTo(oldOutbox);assertThat(audits.count()).isEqualTo(oldAudits);}
    void activity(Long actor,UUID project,String action,Instant at){
        tx.executeWithoutResult(status->{
            var log=taskAudits.saveAndFlush(TaskAuditLog.builder().taskId(taskId).projectId(project).actorId(actor).action(action).afterState("{}").correlationId("activity-test").build());
            jdbc.update("update task_audit_log set occurred_at=? where id=?",LocalDateTime.ofInstant(at,ZoneId.systemDefault()),log.getId());
        });
    }
    @Test void happyBatchCreatesOnePrivateOutboxAndAuditWithoutChangingRosterOrTask()throws Exception{
        var response=result(send(mentorToken,UUID.randomUUID().toString(),body("Please share your progress.",aId,bId)).andExpect(status().isAccepted()));
        assertThat(response.get("recipientCount").asInt()).isEqualTo(2);assertThat(response.get("status").asText()).isEqualTo("PENDING");
        UUID eventId=UUID.fromString(response.get("eventId").asText());var event=outbox.findById(eventId).orElseThrow();
        assertThat(event.getEventType()).isEqualTo("INACTIVE_MEMBER_ALERT_BATCH_SENT");assertThat(event.getStatus()).isEqualTo(OutboxStatus.PENDING);
        var payload=json.readTree(event.getPayloadJson());
        assertThat(java.util.stream.StreamSupport.stream(payload.get("recipient_user_ids").spliterator(),false).map(JsonNode::asLong)).containsExactlyInAnyOrder(aId,bId);
        assertThat(payload.get("actor_id").asLong()).isEqualTo(mentorId);assertThat(payload.get("channels").toString()).contains("IN_APP","EMAIL");
        assertThat(payload.get("correlation_id").asText()).isEqualTo("member-reminder-test");
        assertThat(batches.count()).isEqualTo(oldBatches+1);assertThat(items.count()).isEqualTo(oldItems+2);assertThat(outbox.count()).isEqualTo(oldOutbox+1);assertThat(audits.count()).isEqualTo(oldAudits+1);
        assertThat(audits.findAll().stream().filter(row->row.getBatchId().equals(eventId)).findFirst().orElseThrow().getAction())
                .isEqualTo("INACTIVE_MEMBER_ALERT_BATCH_SENT");
        assertThat(tasks.findById(taskId).orElseThrow().getVersion()).isZero();
        assertThat(memberships.findByTeamIdAndUserId(teamId,aId).orElseThrow().getParticipationStatus()).isEqualTo(ParticipationStatus.ACTIVE);
        mvc.perform(get(endpoint()+"/"+aId+"/reminders").header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk()).andExpect(jsonPath("$[0].warningNote").value("Please share your progress."));
    }
    @Test void noteOver500Is422AndExactly500Works()throws Exception{
        send(mentorToken,UUID.randomUUID().toString(),body("x".repeat(520),aId,bId)).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errors.warningNote[0]").value("Reminder note cannot exceed 500 characters"));unchanged();
        send(mentorToken,UUID.randomUUID().toString(),body("x".repeat(500),aId,bId)).andExpect(status().isAccepted());
    }
    @Test void emptyBlankDuplicateAndMissingKeyAre422()throws Exception{
        send(mentorToken,UUID.randomUUID().toString(),body("",aId)).andExpect(status().isUnprocessableEntity());
        send(mentorToken,UUID.randomUUID().toString(),body("   ",aId)).andExpect(status().isUnprocessableEntity());
        send(mentorToken,UUID.randomUUID().toString(),body("Reminder",aId,aId)).andExpect(status().isUnprocessableEntity());
        send(mentorToken,null,body("Reminder",aId)).andExpect(status().isUnprocessableEntity());unchanged();
    }
    @Test void cooldownIsSharedAcrossMentorLeaderAndAdminAndRollsBackWholeBatch()throws Exception{
        send(mentorToken,UUID.randomUUID().toString(),body("Reminder",aId)).andExpect(status().isAccepted());
        var rejected=result(send(leaderToken,UUID.randomUUID().toString(),body("Leader reminder",aId,bId)).andExpect(status().isUnprocessableEntity()));
        assertThat(rejected.at("/cooldownMembers/0/userId").asLong()).isEqualTo(aId);
        assertThat(rejected.at("/cooldownMembers/0/displayName").asText()).contains("Member A");
        assertThat(rejected.at("/cooldownMembers/0/userCode").asText()).startsWith("U-");
        send(adminToken,UUID.randomUUID().toString(),body("Admin reminder",aId)).andExpect(status().isUnprocessableEntity());
        assertThat(batches.count()).isEqualTo(oldBatches+1);assertThat(items.count()).isEqualTo(oldItems+1);assertThat(outbox.count()).isEqualTo(oldOutbox+1);
    }
    @Test void cooldownExpiresAtExactly24Hours()throws Exception{
        send(mentorToken,UUID.randomUUID().toString(),body("First",aId)).andExpect(status().isAccepted());
        when(clock.instant()).thenReturn(now.plus(Duration.ofHours(24)).minusSeconds(1));
        send(mentorToken,UUID.randomUUID().toString(),body("Too soon",aId)).andExpect(status().isUnprocessableEntity());
        when(clock.instant()).thenReturn(now.plus(Duration.ofHours(24)));
        send(mentorToken,UUID.randomUUID().toString(),body("Allowed",aId)).andExpect(status().isAccepted());
    }
    @Test void replayUsesOldResultDuringCooldownAndPayloadChangeConflicts()throws Exception{
        String key=UUID.randomUUID().toString(),payload=body("Same reminder",aId,bId);
        var a=result(send(mentorToken,key,payload).andExpect(status().isAccepted()));
        var b=result(send(mentorToken,key,payload).andExpect(status().isAccepted()));
        assertThat(a.get("batchId")).isEqualTo(b.get("batchId"));
        send(mentorToken,key,body("Changed",aId,bId)).andExpect(status().isConflict());
        assertThat(outbox.count()).isEqualTo(oldOutbox+1);
    }
    @Test void concurrentDifferentKeysAllowOneBatchAndRejectOtherWithCooldown()throws Exception{
        var start=new CountDownLatch(1);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
            Callable<Integer> call=()->{start.await();return send(mentorToken,UUID.randomUUID().toString(),body("Concurrent",aId)).andReturn().getResponse().getStatus();};
            var a=pool.submit(call);var b=pool.submit(call);start.countDown();assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(202,422);
        }assertThat(outbox.count()).isEqualTo(oldOutbox+1);
    }
    @Test void concurrentSameKeyReplaysOneEvent()throws Exception{
        var start=new CountDownLatch(1);String key=UUID.randomUUID().toString(),payload=body("Concurrent retry",aId,bId);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
            Callable<JsonNode> call=()->{start.await();return result(send(mentorToken,key,payload).andExpect(status().isAccepted()));};
            var a=pool.submit(call);var b=pool.submit(call);start.countDown();assertThat(a.get(15,TimeUnit.SECONDS).get("batchId")).isEqualTo(b.get(15,TimeUnit.SECONDS).get("batchId"));
        }assertThat(outbox.count()).isEqualTo(oldOutbox+1);assertThat(audits.count()).isEqualTo(oldAudits+1);
    }
    @Test void contributionCountsActorNotAssigneeAndIgnoresOtherProjectAndAlertViewLogs()throws Exception{
        activity(mentorId,projectAlias,"UPDATE",now.minusSeconds(5));
        activity(aId,UUID.randomUUID(),"UPDATE",now.minusSeconds(5));
        activity(aId,projectAlias,"OVERDUE_ALERT_QUEUED",now.minusSeconds(5));
        activity(aId,projectAlias,"VIEW",now.minusSeconds(5));
        mvc.perform(get(endpoint()).header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(2));
        activity(bId,projectAlias,"STATUS_CHANGED",now.minusSeconds(1));
        mvc.perform(get(endpoint()).header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.content[0].userId").value(aId));
        unchanged();
    }
    @Test void inactivityAndJoinGraceHaveExactSevenDayBoundary()throws Exception{
        activity(aId,projectAlias,"UPDATE",now.minus(Duration.ofDays(7)));
        send(mentorToken,UUID.randomUUID().toString(),body("At boundary",aId)).andExpect(status().isAccepted());
        activity(bId,projectAlias,"UPDATE",now.minus(Duration.ofDays(7)).plusSeconds(1));
        send(mentorToken,UUID.randomUUID().toString(),body("Still active",bId)).andExpect(status().isConflict());
        send(mentorToken,UUID.randomUUID().toString(),body("New leader",leaderId)).andExpect(status().isConflict());
    }
    @Test void legacyJoinedDateFallbackWorksAndOldContributionsBeforeRejoinDoNotCount()throws Exception{
        tx.executeWithoutResult(status->{
            var row=memberships.findByTeamIdAndUserId(teamId,aId).orElseThrow();row.setJoinedAt(null);memberships.flush();
            jdbc.update("update team_members set created_at=? where id=?",LocalDateTime.ofInstant(now.minus(Duration.ofDays(8)),ZoneId.systemDefault()),row.getId());
            memberships.findByTeamIdAndUserId(teamId,bId).orElseThrow().setJoinedAt(now.minus(Duration.ofDays(1)));
        });
        activity(bId,projectAlias,"UPDATE",now.minus(Duration.ofDays(2)));
        mvc.perform(get(endpoint()).header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.content[0].userId").value(aId));
        unchanged();
    }
    @Test void externalArtifactAndCommitContributionsCanKeepMembersActive()throws Exception{
        when(external.latest(eq(projectAlias),anySet(),any())).thenReturn(Map.of(aId,now.minus(Duration.ofDays(1)),bId,now.minus(Duration.ofDays(2))));
        mvc.perform(get(endpoint()).header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));unchanged();
    }
    @Test void externalFailureFallsBackToRealTaskAuditAndFutureEventsAreIgnored()throws Exception{
        activity(aId,projectAlias,"UPDATE",now.minusSeconds(1));
        when(external.latest(any(),anySet(),any())).thenThrow(new IllegalStateException("Unavailable"));
        mvc.perform(get(endpoint()).header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.content[0].userId").value(bId));
        doReturn(Map.of(bId,now.plusSeconds(10))).when(external).latest(any(),anySet(),any());
        mvc.perform(get(endpoint()).header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1));unchanged();
    }
    @ParameterizedTest @ValueSource(strings={"RECENT","LEFT","LOCKED"})
    void staleRecipientRollsBackWholeBatch(String change)throws Exception{
        String payload=body("Keep selection",aId,bId);
        if(change.equals("RECENT"))activity(bId,projectAlias,"UPDATE",now.minusSeconds(1));
        else tx.executeWithoutResult(status->{if(change.equals("LEFT"))memberships.findByTeamIdAndUserId(teamId,bId).orElseThrow().setParticipationStatus(ParticipationStatus.LEFT);
            else users.findById(bId).orElseThrow().setLocked(true);});
        send(mentorToken,UUID.randomUUID().toString(),payload).andExpect(status().isConflict());unchanged();
    }
    @Test void actualTaskStatusUpdateMakesStudentActiveBeforePreparedReminder()throws Exception{
        String payload=body("Prepared reminder",aId,bId);
        mvc.perform(patch("/api/tasks/"+taskId+"/status").header("Authorization","Bearer "+aToken).header("Idempotency-Key",UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\",\"version\":0}")).andExpect(status().isOk());
        send(mentorToken,UUID.randomUUID().toString(),payload).andExpect(status().isConflict());unchanged();
    }
    @Test void inFlightContributionCommitsBeforeReminderCanEvaluate()throws Exception{
        var held=new CountDownLatch(1);var release=new CountDownLatch(1);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
            var contribution=pool.submit(()->tx.executeWithoutResult(status->{
                users.lockForContribution(List.of(aId));
                var snapshot=TaskDTO.builder().id(taskId).projectId(projectAlias).title("Resume work").build();
                taskAudit.record("UPDATE",snapshot,snapshot,aId,"concurrent-contribution");taskAudits.flush();held.countDown();
                try{if(!release.await(10,TimeUnit.SECONDS))throw new IllegalStateException("No release");}catch(InterruptedException ex){throw new IllegalStateException(ex);}
            }));
            assertThat(held.await(10,TimeUnit.SECONDS)).isTrue();
            var reminder=pool.submit(()->send(mentorToken,UUID.randomUUID().toString(),body("Reminder",aId,bId)).andReturn().getResponse().getStatus());
            try{assertThatThrownBy(()->reminder.get(200,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);}
            finally{release.countDown();}
            contribution.get(10,TimeUnit.SECONDS);assertThat(reminder.get(10,TimeUnit.SECONDS)).isEqualTo(409);
        }unchanged();
    }
    @Test void authenticationPermissionAndAssignmentAreRechecked()throws Exception{
        String payload=body("Reminder",aId);
        send(null,UUID.randomUUID().toString(),payload).andExpect(status().isUnauthorized());
        send("invalid",UUID.randomUUID().toString(),payload).andExpect(status().isUnauthorized());
        send(aToken,UUID.randomUUID().toString(),payload).andExpect(status().isForbidden());
        mvc.perform(get(endpoint()).header("Authorization","Bearer "+aToken)).andExpect(status().isForbidden());
        tx.executeWithoutResult(status->roles.findById(roleId).orElseThrow().getPermissions().removeIf(permission->permission.getName().equals("INACTIVE_MEMBER_SEND")));
        send(mentorToken,UUID.randomUUID().toString(),payload).andExpect(status().isForbidden());
        tx.executeWithoutResult(status->{roles.findById(roleId).orElseThrow().getPermissions().add(permissions.findByName("INACTIVE_MEMBER_SEND").orElseThrow());teams.findById(teamId).orElseThrow().setMentor(null);});
        send(mentorToken,UUID.randomUUID().toString(),payload).andExpect(status().isForbidden());unchanged();
    }
    @Test void inactiveTenantAndForeignProjectAre403WithoutMemberData()throws Exception{
        mvc.perform(get("/api/projects/"+UUID.randomUUID()+"/inactive-members").header("Authorization","Bearer "+mentorToken)).andExpect(status().isForbidden());
        tx.executeWithoutResult(status->tenants.findById(tenantId).orElseThrow().setActive(false));
        send(adminToken,UUID.randomUUID().toString(),body("Reminder",aId)).andExpect(status().isForbidden());unchanged();
    }
    @Test void failedOutboxRollsBackBatchItemsAuditAndCooldown()throws Exception{
        doThrow(new IllegalStateException("Simulated failure")).when(outbox).saveAndFlush(any(OutboxEvent.class));
        try{send(mentorToken,UUID.randomUUID().toString(),body("Reminder",aId,bId)).andExpect(status().isInternalServerError());}finally{reset(outbox);}
        unchanged();
        send(mentorToken,UUID.randomUUID().toString(),body("Retry",aId,bId)).andExpect(status().isAccepted());
    }
    @Test @org.springframework.transaction.annotation.Transactional
    void localDemoUsesExistingUsersAndDoesNotResetJoinedDateOrContribution()throws Exception{
        long userCount=users.count();demo.seed();
        var admin=users.findByEmail("admin@example.com").orElseThrow();var project=datasets.findById(admin.getTenant().getId()).orElseThrow().getProjectId();
        String teacherToken=token(users.findByEmail("teacher@example.com").orElseThrow());
        mvc.perform(get("/api/projects/"+project+"/inactive-members").header("Authorization","Bearer "+teacherToken)).andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1));
        var source=projectLinks.findById(project).orElseThrow();var team=teams.findFirstByProjectIdOrderByIdAsc(source.getProjectId()).orElseThrow();
        var student=users.findByEmail("student@example.com").orElseThrow();
        var member=memberships.findByTeamIdAndUserId(team.getId(),student.getId()).orElseThrow();member.setJoinedAt(now);memberships.flush();
        long count=tasks.count();demo.seed();assertThat(users.count()).isEqualTo(userCount);assertThat(tasks.count()).isEqualTo(count);
        assertThat(memberships.findById(member.getId()).orElseThrow().getJoinedAt()).isEqualTo(now);
    }
}
