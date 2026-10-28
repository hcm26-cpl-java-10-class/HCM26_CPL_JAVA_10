package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.activity.*;
import com.example.starter_project_2025.system.project.domain.*;
import com.example.starter_project_2025.system.project.tenant.*;
import com.example.starter_project_2025.system.project.trainingclass.*;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.*;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.outbox.*;
import com.example.starter_project_2025.system.rbac.user.*;
import com.example.starter_project_2025.system.rbac.role.*;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.fasterxml.jackson.databind.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"app.seed.board.enabled=false","app.seed.team-allocation.enabled=false",
        "app.task-alert.demo.enabled=false","app.member-reminder.demo.enabled=false",
        "milestone.mock.seed-enabled=false","milestone.submission.mock.seed-enabled=false"})
@AutoConfigureMockMvc @ActiveProfiles({"test","artifact-real-scope"})
class ProjectAlertIntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired TransactionTemplate tx; @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em; @Autowired UserRepository users; @Autowired TenantRepository tenants;
    @Autowired RoleRepository roles; @Autowired PermissionRepository permissions;
    @Autowired TrainingClassRepository classes; @Autowired ClassMemberRepository classMembers;
    @Autowired TeamAllocationSessionRepository sessions; @Autowired ProjectTeamRepository teams;
    @Autowired ProjectMemberRepository members; @Autowired ProjectRepository projects;
    @Autowired SprintRepository sprints; @Autowired SprintBacklogRepository backlogs;
    @Autowired MilestoneRepository milestones; @Autowired ProjectActivityRepository activity;
    @Autowired com.example.starter_project_2025.system.project.workspace.config.ExistingClassRosterContextRepair contextRepair;
    @Autowired ProjectAlertBatchRepository batches; @Autowired ProjectAlertRecipientRepository recipients;
    @Autowired ProjectAlertMonitor monitor; @Autowired LegacyMilestoneBacklogMigration legacyMigration;
    @Autowired ProjectAlertAuditRepository audits; @Autowired AlertMilestoneConfigRepository configs;
    @Autowired com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactSubmissionRepository submissions;
    @Autowired com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository milestoneAudits;
    @SpyBean OutboxEventRepository outbox;
    @MockBean(name="memberReminderClock") Clock clock;
    @MockBean AlertExternalContributions external;
    @Autowired UserDetailsService details; @Autowired RefreshTokenService tokens;
    Instant now; Long tenantId,classId,otherClassId,teamId,otherTeamId,projectId,sprintId,mentorId,mentorRoleId,aId,bId,leaderId,aMembershipId,adminId;
    Long overdueId,upcomingId,doneId; UUID milestoneId;
    String mentorToken,adminToken,leaderToken,studentToken;
    long oldBatches,oldRecipients,oldAudits,oldEvents;
    User user(Tenant tenant,Role role,String name) {
        User u=new User();u.setEmail(UUID.randomUUID()+"@alerts.test");u.setFirstName(name);u.setLastName("Test");u.setPasswordHash("unused");
        u.setUserCode("U-"+UUID.randomUUID());u.setTenant(tenant);u.setRoles(new HashSet<>(Set.of(role)));return users.saveAndFlush(u);
    }
    String token(User u) {var principal=details.loadUserByUsername(u.getEmail());return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()));}
    TrainingClass schoolClass(Long tenant,Long program,Long cohort,Long mentor) {
        var c=new TrainingClass();c.setTenantId(tenant);c.setCode("CLASS-"+UUID.randomUUID());c.setName("Class "+program);
        c.setProgramId(program);c.setProgramName("Program "+program);c.setCohortId(cohort);c.setCohortName("Cohort "+cohort);
        c.setMentorId(mentor);c.setStatus(TrainingClassStatus.ONGOING);return classes.saveAndFlush(c);
    }
    ProjectTeam team(TrainingClass c,Project project) {
        var session=new TeamAllocationSession();session.setTrainingClass(c);session.setMaxMembers(8);session.setStatus(TeamAllocationSessionStatus.PUBLISHED);session.setVersion(0L);session=sessions.saveAndFlush(session);
        var t=new ProjectTeam();t.setTrainingClass(c);t.setAllocationSession(session);t.setTeamName("Team "+c.getProgramId());t.setProject(project);
        t.setAssignedMentorId(c.getMentorId());t.setMaxMembers(8);t.setStatus(ProjectTeamStatus.ACTIVE);t.setVersion(0L);return teams.saveAndFlush(t);
    }
    ProjectMember member(ProjectTeam team,User user,String role,long days) {
        var cm=new ClassMember();cm.setTrainingClass(team.getTrainingClass());cm.setUser(user);cm.setStatus(ClassMemberStatus.ACTIVE);
        cm.setJoinedAt(LocalDateTime.now().minusDays(30));classMembers.saveAndFlush(cm);
        var m=new ProjectMember();m.setTeam(team);m.setClassMember(cm);m.setRole(role);members.saveAndFlush(m);
        jdbc.update("update project_members set created_at=? where id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(days))),m.getId());
        return m;
    }
    SprintBacklog item(Sprint sprint,Long assignee,String title,SprintBacklogStatus status,Instant due) {
        var b=new SprintBacklog();b.setSprint(sprint);b.setAssigneeProjectMemberId(assignee);b.setTitle(title);b.setStatus(status);
        b.setStartDate(LocalDateTime.ofInstant(now.minus(Duration.ofDays(7)),ZoneId.of("Asia/Ho_Chi_Minh")));
        b.setEndDate(due==null?null:LocalDateTime.ofInstant(due,ZoneId.of("Asia/Ho_Chi_Minh")));b=backlogs.saveAndFlush(b);
        jdbc.update("update sprint_backlog set created_at=? where sprint_backlog_id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(8))),b.getId());
        return b;
    }
    @BeforeEach void setup() {
        now=Instant.now().truncatedTo(ChronoUnit.SECONDS).plusSeconds(60);when(clock.instant()).thenReturn(now);
        when(external.latest(any(),any(),anySet(),any())).thenReturn(Map.of());
        tx.executeWithoutResult(status->{
            var scopedAdmin=roles.findByName("ADMIN").orElseThrow();
            scopedAdmin.getPermissions().removeIf(p->Set.of("PEO_TEAM_ALLOCATE","PRJ_WORKSPACE_MANAGE").contains(p.getName()));
            roles.saveAndFlush(scopedAdmin);
            Tenant tenant=tenants.saveAndFlush(Tenant.builder().code("ALERT-"+UUID.randomUUID()).name("Alert tenant").build());tenantId=tenant.getId();
            var role=new Role();role.setName("ALERT-"+UUID.randomUUID());role.setPermissions(new HashSet<>(permissions.findAll()));role=roles.saveAndFlush(role);mentorRoleId=role.getId();
            var mentor=user(tenant,role,"Mentor");mentorId=mentor.getId();mentorToken=token(mentor);
            var admin=user(tenant,roles.findByName("ADMIN").orElseThrow(),"Admin");adminId=admin.getId();adminToken=token(admin);
            var a=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Member A");aId=a.getId();studentToken=token(a);
            var b=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Member B");bId=b.getId();
            var leader=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Leader");leaderId=leader.getId();leaderToken=token(leader);
            var p=new Project();p.setTenant(tenant);p.setCode("ALERT-"+UUID.randomUUID());p.setName("Real project");p.setStatus(ProjectStatus.ACTIVE);projectId=projects.saveAndFlush(p).getId();
            var c=schoolClass(tenantId,101L,201L,mentorId);classId=c.getId();var team=team(c,p);teamId=team.getId();
            var other=schoolClass(tenantId,102L,202L,null);otherClassId=other.getId();otherTeamId=team(other,null).getId();
            var ma=member(team,a,"DEV",8);aMembershipId=ma.getId();var mb=member(team,b,"QA",9);member(team,leader,"PM",1);
            var sprint=Sprint.builder().teamId(teamId).projectId(projectId).name("Real sprint "+UUID.randomUUID()).startDate(LocalDateTime.now().minusDays(10))
                    .endDate(LocalDateTime.now().plusDays(3)).build();sprint=sprints.saveAndFlush(sprint);sprintId=sprint.getId();
            overdueId=item(sprint,ma.getId(),"Overdue parent item",SprintBacklogStatus.TODO,now.minusSeconds(3600)).getId();
            var pendingBoard=com.example.starter_project_2025.system.project.sprint.Task.builder().teamId(teamId).projectId(projectId)
                    .assigneeProjectMemberId(mb.getId()).title("Unstarted task for member B").code("PENDING-"+UUID.randomUUID()).build();em.persist(pendingBoard);em.flush();
            jdbc.update("update sprint_task set created_at=? where task_id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(8))),pendingBoard.getId());
            upcomingId=item(sprint,ma.getId(),"Upcoming parent item",SprintBacklogStatus.IN_PROGRESS,now.plusSeconds(7200)).getId();
            doneId=item(sprint,ma.getId(),"Finished parent item",SprintBacklogStatus.DONE,now.minusSeconds(3600)).getId();
            var m=Milestone.create(tenantId,projectId,teamId,"Real milestone",null,now.plus(Duration.ofHours(24)),true,UUID.randomUUID(),null,
                    LatePolicyType.NO_LATE,null,null,UUID.randomUUID(),now);m.openForWork(UUID.randomUUID(),now);milestoneId=milestones.saveAndFlush(m).getId();
        });
        oldBatches=batches.count();oldRecipients=recipients.count();oldAudits=audits.count();oldEvents=outbox.count();
    }
    ResultActions list(String kind,String token,Long team) throws Exception {
        var request=get("/api/project-alerts/"+kind).header("Authorization","Bearer "+token);if(team!=null)request.param("teamId",team.toString());return mvc.perform(request);
    }
    String payload(String kind,String note,Long... ids) throws Exception {
        var selections=Arrays.stream(ids).map(id->Map.of("id",id.toString(),"version",backlogs.findById(id).orElseThrow().getVersion())).toList();
        return json.writeValueAsString(Map.of("teamId",teamId,"kind",kind,"warningNote",note,"selections",selections));
    }
    String memberPayload(String note,Long... ids) throws Exception {
        return json.writeValueAsString(Map.of("teamId",teamId,"kind","INACTIVE","warningNote",note,"selections",Arrays.stream(ids).map(id->Map.of("id",id.toString())).toList()));
    }
    String milestonePayload() throws Exception {return json.writeValueAsString(Map.of("teamId",teamId,"kind","MILESTONE","warningNote","",
            "selections",List.of(Map.of("id",milestoneId.toString(),"version",milestones.findById(milestoneId).orElseThrow().getVersion()))));}
    ResultActions send(String token,String key,String body) throws Exception {
        var request=post("/api/project-alerts/send").contentType(MediaType.APPLICATION_JSON).content(body).header("X-Correlation-ID","project-alert-test");
        if(token!=null)request.header("Authorization","Bearer "+token);if(key!=null)request.header("Idempotency-Key",key);return mvc.perform(request);
    }
    ResultActions links(String token,Long... ids) throws Exception {
        return mvc.perform(put("/api/project-alerts/teams/{team}/milestones/{id}/backlog-items",teamId,milestoneId)
                .header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("milestoneVersion",milestones.findById(milestoneId).orElseThrow().getVersion(),"backlogItemIds",List.of(ids)))));
    }
    void recordStart(Long actor,Long backlogId,Instant at) {
        tx.executeWithoutResult(status->{var event=com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog.builder()
                .sprintBacklogId(backlogId).sprintId(sprintId).actorId(actor).action("UPDATE").beforeState("{\"status\":\"TODO\"}")
                .afterState("{\"status\":\"IN_PROGRESS\"}").correlationId("start-work").build();em.persist(event);em.flush();
            jdbc.update("update sprint_backlog_audit_log set created_at=? where id=?",java.sql.Timestamp.from(at),event.getId());});
    }
    void unchanged() {assertThat(batches.count()).isEqualTo(oldBatches);assertThat(recipients.count()).isEqualTo(oldRecipients);
        assertThat(audits.count()).isEqualTo(oldAudits);assertThat(outbox.count()).isEqualTo(oldEvents);}
    @Test void optionsAndCascadingFiltersUseActualAssignedClassAndTeam() throws Exception {
        mvc.perform(get("/api/project-alerts/options").header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.teams.length()").value(1)).andExpect(jsonPath("$.teams[0].id").value(teamId))
                .andExpect(jsonPath("$.teams[0].programId").value(101)).andExpect(jsonPath("$.teams[0].cohortId").value(201));
        mvc.perform(get("/api/project-alerts/options").header("Authorization","Bearer "+adminToken)).andExpect(status().isOk()).andExpect(jsonPath("$.teams.length()").value(2));
        mvc.perform(get("/api/project-alerts/backlog").param("programId","102").header("Authorization","Bearer "+adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        list("backlog",mentorToken,otherTeamId).andExpect(status().isForbidden());unchanged();
    }
    @Test void onlyOverdueTopLevelBacklogItemsAreMonitoredAndViewingDoesNotCreateRecords() throws Exception {
        tx.executeWithoutResult(status->{em.persist(com.example.starter_project_2025.system.project.sprint.Task.builder().projectId(projectId).teamId(teamId)
                .title("Board subtask").code("SUB-"+UUID.randomUUID()).build());});
        list("backlog",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].title").value("Overdue parent item")).andExpect(jsonPath("$.content[0].canSend").value(true));unchanged();
    }
    @Test void queueBacklogAlertWritesOnePendingOutboxAndAuditAndDeduplicatesRecipient() throws Exception {
        tx.executeWithoutResult(status->backlogs.findById(upcomingId).orElseThrow().setEndDate(LocalDateTime.ofInstant(now.minusSeconds(60),ZoneId.of("Asia/Ho_Chi_Minh"))));
        var response=send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","Please update the parent items.",overdueId,upcomingId))
                .andExpect(status().isAccepted()).andExpect(jsonPath("$.recipientCount").value(1)).andExpect(jsonPath("$.status").value("PENDING")).andReturn().getResponse();
        UUID eventId=UUID.fromString(json.readTree(response.getContentAsString()).get("eventId").asText());
        var event=outbox.findById(eventId).orElseThrow();assertThat(event.getEventType()).isEqualTo("BACKLOG_OVERDUE_ALERT_BATCH_SENT");
        assertThat(json.readTree(event.getPayloadJson()).get("recipient_user_ids").size()).isEqualTo(1);
        assertThat(batches.count()).isEqualTo(oldBatches+1);assertThat(audits.count()).isEqualTo(oldAudits+1);assertThat(outbox.count()).isEqualTo(oldEvents+1);
        assertThat(backlogs.findById(overdueId).orElseThrow().getStatus()).isEqualTo(SprintBacklogStatus.TODO);
    }
    @Test void noteOver500AndBlankAndMissingIdempotencyAre422() throws Exception {
        send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","x".repeat(520),overdueId)).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errors.warningNote").isArray());
        send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","  ",overdueId)).andExpect(status().isUnprocessableEntity());
        send(mentorToken,null,payload("BACKLOG","Valid",overdueId)).andExpect(status().isUnprocessableEntity());unchanged();
    }
    @Test void futureAndDoneAndUnassignedItemsRollbackTheWholeBatch() throws Exception {
        send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","Reminder",overdueId,upcomingId)).andExpect(status().isConflict());
        send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","Reminder",overdueId,doneId)).andExpect(status().isConflict());
        tx.executeWithoutResult(status->backlogs.findById(overdueId).orElseThrow().setAssigneeProjectMemberId(null));
        send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","Reminder",overdueId)).andExpect(status().isConflict());unchanged();
    }
    @Test void replayCreatesOneEventAndChangedPayloadConflicts() throws Exception {
        String key=UUID.randomUUID().toString(),body=payload("BACKLOG","Reminder",overdueId);
        String result=send(mentorToken,key,body).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        send(mentorToken,key,body).andExpect(status().isAccepted()).andExpect(content().json(result));
        send(mentorToken,key,payload("BACKLOG","Different",overdueId)).andExpect(status().isConflict());
        assertThat(batches.count()).isEqualTo(oldBatches+1);assertThat(outbox.count()).isEqualTo(oldEvents+1);
    }
    @Test void startingAnyTaskSuppressesInactivityEvenWhenOtherTodoWorkRemains() throws Exception {
        recordStart(bId,doneId,now.minusSeconds(10));
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].id").value(aId.toString()));
        recordStart(aId,doneId,now.minusSeconds(5));
        assertThat(backlogs.findById(overdueId).orElseThrow().getStatus()).isEqualTo(SprintBacklogStatus.TODO);
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));unchanged();
    }
    @Test void cooldownIsSharedBetweenMentorAndActualPmAndIsAtomic() throws Exception {
        String first=memberPayload("Please contribute an update.",aId);
        send(mentorToken,UUID.randomUUID().toString(),first).andExpect(status().isAccepted());
        send(leaderToken,UUID.randomUUID().toString(),memberPayload("Another reminder",aId,bId)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.cooldownMembers[0].userId").value(aId));
        assertThat(batches.count()).isEqualTo(oldBatches+1);assertThat(recipients.count()).isEqualTo(oldRecipients+1);
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
    }
    @Test void newlyActiveOrRemovedMemberRejectsAllSelectedRecipients() throws Exception {
        String body=memberPayload("Reminder",aId,bId);
        tx.executeWithoutResult(status->members.findById(aMembershipId).orElseThrow().setIsActive(false));
        send(mentorToken,UUID.randomUUID().toString(),body).andExpect(status().isConflict());unchanged();
    }
    @Test void unrelatedAndExternalContributionsDoNotResetTheTaskStartWindow() throws Exception {
        tx.executeWithoutResult(status->activity.saveAndFlush(ProjectActivityLog.builder().projectId(projectId).actorId(aId).actionType("ALERT_SENT")
                .entityType("ALERT").entityId(7L).beforeState("{}").afterState("{}").build()));
        when(external.latest(any(),any(),anySet(),any())).thenReturn(Map.of(aId,now.minusSeconds(10)));
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        recordStart(aId,doneId,now.plusSeconds(10));
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(2));unchanged();
    }
    @Test void milestoneAutomaticallyUsesItsOwnBacklogRelationIncludingDoneItems() throws Exception {
        tx.executeWithoutResult(status->{var m=milestones.findById(milestoneId).orElseThrow();
            backlogs.findById(overdueId).orElseThrow().setMilestone(m);backlogs.findById(doneId).orElseThrow().setMilestone(m);});
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].progress.percentage").value(50))
                .andExpect(jsonPath("$.content[0].progress.total").value(2)).andExpect(jsonPath("$.content[0].progress.atRisk").value(true));
        send(mentorToken,UUID.randomUUID().toString(),milestonePayload()).andExpect(status().isAccepted()).andExpect(jsonPath("$.recipientCount").value(3));
        assertThat(milestones.findById(milestoneId).orElseThrow().getStatus()).isEqualTo(MilestoneStatus.OPEN);
    }
    @Test void emptyMilestoneHasZeroProgressWithoutManualConfiguration() throws Exception {
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].progress.percentage").value(0))
                .andExpect(jsonPath("$.content[0].progress.total").value(0));
        send(mentorToken,UUID.randomUUID().toString(),milestonePayload()).andExpect(status().isAccepted());
    }
    @Test void milestoneDoneProgressIsReevaluatedBeforeSending() throws Exception {
        links(mentorToken,overdueId).andExpect(status().isOk());
        String body=milestonePayload();tx.executeWithoutResult(status->backlogs.findById(overdueId).orElseThrow().setStatus(SprintBacklogStatus.DONE));
        send(mentorToken,UUID.randomUUID().toString(),body).andExpect(status().isConflict());unchanged();
    }
    JsonNode milestoneView(String token) throws Exception {
        return json.readTree(list("milestones",token,teamId).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("content").get(0);
    }
    @Test void milestoneReturnsOnlyTeamProgressWithoutMemberBreakdown() throws Exception {
        Long[] extra=new Long[1];
        tx.executeWithoutResult(status->{var b=members.findByTeam_IdAndClassMember_User_Id(teamId,bId).orElseThrow();
            extra[0]=item(sprints.findById(sprintId).orElseThrow(),b.getId(),"Second completed item",SprintBacklogStatus.DONE,null).getId();});
        links(mentorToken,overdueId,doneId,extra[0]).andExpect(status().isOk());
        var view=milestoneView(mentorToken);
        assertThat(view.get("progress").get("done").asInt()).isEqualTo(2);
        assertThat(view.get("progress").get("total").asInt()).isEqualTo(3);
        assertThat(view.get("progress").get("percentage").decimalValue()).isEqualByComparingTo("66.67");
        assertThat(view.has("memberProgress")).isFalse();assertThat(view.has("submission")).isFalse();unchanged();
    }
    @Test void unassignedWorkAndRemovedStudentsRemainInMilestoneProgress() throws Exception {
        links(mentorToken,overdueId,doneId).andExpect(status().isOk());
        tx.executeWithoutResult(status->{backlogs.findById(overdueId).orElseThrow().setAssigneeProjectMemberId(null);
            members.findById(aMembershipId).orElseThrow().setIsActive(false);});
        var view=milestoneView(mentorToken);assertThat(view.get("progress").get("total").asInt()).isEqualTo(2);
        assertThat(view.get("progress").get("percentage").asInt()).isEqualTo(50);unchanged();
    }
    @Test void milestoneProgressDoesNotRequireMemberDetailsPermission() throws Exception {
        links(mentorToken,overdueId,doneId).andExpect(status().isOk());
        tx.executeWithoutResult(status->roles.findById(mentorRoleId).orElseThrow().getPermissions().removeIf(p->p.getName().equals("WORKSPACE_MEMBER_READ")));
        var view=milestoneView(mentorToken);assertThat(view.get("progress").get("percentage").asInt()).isEqualTo(50);
        assertThat(view.has("canConfigure")).isFalse();assertThat(view.has("memberProgress")).isFalse();unchanged();
    }
    @Test void milestoneAutomaticallyIncludesUnassignedProductBacklogItems() throws Exception {
        tx.executeWithoutResult(status->{var item=backlogs.findById(overdueId).orElseThrow();item.setSprint(null);item.setAssigneeProjectMemberId(null);
            item.setMilestone(milestones.findById(milestoneId).orElseThrow());});
        var view=milestoneView(mentorToken);assertThat(view.get("progress").get("total").asInt()).isEqualTo(1);
        assertThat(view.get("progress").get("percentage").asInt()).isZero();unchanged();
    }
    @Test void orphanUuidAuditRowsDoNotPretendThatAStudentStartedWork() throws Exception {
        UUID alias=UUID.randomUUID();
        tx.executeWithoutResult(status->{var bridge=new com.example.starter_project_2025.system.project.task.alert.TaskAlertData.ProjectLink();
            bridge.setId(alias);bridge.setProjectId(projectId);bridge.setTenantId(tenantId);em.persist(bridge);
            em.persist(com.example.starter_project_2025.system.project.task.audit.TaskAuditLog.builder().taskId(UUID.randomUUID()).projectId(alias)
                    .actorId(aId).action("STATUS_CHANGED").beforeState("TODO").afterState("IN_PROGRESS").correlationId("orphan").build());});
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));unchanged();
    }
    @Test void missingMilestoneReturns404AndStudentCannotConfigureOrReadOthers() throws Exception {
        links(leaderToken,overdueId).andExpect(status().isForbidden());
        list("backlog",studentToken,teamId).andExpect(status().isForbidden());
        tx.executeWithoutResult(status->milestones.findById(milestoneId).orElseThrow().softDelete(UUID.randomUUID(),now));
        send(mentorToken,UUID.randomUUID().toString(),milestonePayload()).andExpect(status().isNotFound());unchanged();
    }
    @Test void permissionsAreCheckedOnBackendAndUnauthenticatedRequestsAre401() throws Exception {
        mvc.perform(get("/api/project-alerts/options")).andExpect(status().isUnauthorized());
        tx.executeWithoutResult(status->roles.findById(mentorRoleId).orElseThrow().getPermissions().removeIf(p->p.getName().equals("TASK_ALERT_SEND")));
        list("backlog",mentorToken,teamId).andExpect(status().isOk());
        send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","Reminder",overdueId)).andExpect(status().isForbidden());unchanged();
    }
    @Test void integrationFailureKeepsCoreActivityAndSensitiveFieldsAreNotReturned() throws Exception {
        when(external.latest(any(),any(),anySet(),any())).thenThrow(new IllegalStateException("External unavailable"));
        var response=list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andReturn().getResponse();
        var body=json.readTree(response.getContentAsString());
        for(String field:List.of("password","passwordHash","token","email","phone","draftScore","feedback"))assertThat(body.findValues(field)).isEmpty();
        unchanged();
    }
    @Test void outboxFailureRollsBackBatchAndAudit() throws Exception {
        doThrow(new IllegalStateException("Outbox unavailable")).when(outbox).saveAndFlush(any(OutboxEvent.class));
        send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","Reminder",overdueId)).andExpect(status().isInternalServerError());unchanged();
    }
    @Test void existingTeacherAndStudentPmRolesCanMonitorAssignedTeams() throws Exception {
        String teacher=tx.execute(status->{
            var account=user(tenants.findById(tenantId).orElseThrow(),roles.findByName("TEACHER").orElseThrow(),"Real teacher");
            classes.findById(classId).orElseThrow().setMentorId(account.getId());return token(account);
        });
        mvc.perform(get("/api/project-alerts/options").header("Authorization","Bearer "+teacher)).andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions.BACKLOG_READ").value(true)).andExpect(jsonPath("$.permissions.BACKLOG_SEND").value(true))
                .andExpect(jsonPath("$.permissions.MILESTONE_CONFIGURE").doesNotExist());
        list("backlog",teacher,teamId).andExpect(status().isOk());
        send(teacher,UUID.randomUUID().toString(),payload("BACKLOG","Teacher reminder",overdueId)).andExpect(status().isAccepted());
        list("backlog",leaderToken,teamId).andExpect(status().isOk());
        send(leaderToken,UUID.randomUUID().toString(),payload("BACKLOG","PM reminder",overdueId)).andExpect(status().isAccepted());
        list("backlog",studentToken,teamId).andExpect(status().isForbidden());
    }
    @Test void exactSevenDayAndTwentyFourHourBoundariesAreInclusive() throws Exception {
        jdbc.update("update project_members set created_at=? where id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(7))),aMembershipId);
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        String body=memberPayload("Please post a progress update.",aId);
        send(mentorToken,UUID.randomUUID().toString(),body).andExpect(status().isAccepted());
        when(clock.instant()).thenReturn(now.plus(Duration.ofHours(24)).minusSeconds(1));
        send(leaderToken,UUID.randomUUID().toString(),body).andExpect(status().isUnprocessableEntity());
        when(clock.instant()).thenReturn(now.plus(Duration.ofHours(24)));
        send(leaderToken,UUID.randomUUID().toString(),body).andExpect(status().isAccepted());
        assertThat(batches.count()).isEqualTo(oldBatches+2);
    }
    @Test void recentTransferResetsGracePeriodUsingTeamHistory() throws Exception {
        tx.executeWithoutResult(status->{
            var member=members.findById(aMembershipId).orElseThrow();
            var history=ProjectTeamMemberHistory.builder().classId(classId).allocationSessionId(member.getTeam().getAllocationSession().getId())
                    .memberId(member.getClassMember().getId()).memberName("Member A").toTeamId(teamId).action("MEMBER_TRANSFERRED")
                    .actorId(mentorId).actorName("Mentor").build();em.persist(history);em.flush();
            jdbc.update("update project_team_member_history set created_at=? where id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(1))),history.getId());
        });
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].id").value(bId.toString()));unchanged();
    }
    @Test void foreignTenantAndInactiveTenantNeverExposeOrSendData() throws Exception {
        Long[] foreignTeam=new Long[1];
        tx.executeWithoutResult(status->{
            var tenant=tenants.saveAndFlush(Tenant.builder().code("FOREIGN-"+UUID.randomUUID()).name("Foreign tenant").build());
            foreignTeam[0]=team(schoolClass(tenant.getId(),101L,201L,null),null).getId();
        });
        list("backlog",adminToken,foreignTeam[0]).andExpect(status().isForbidden());
        tx.executeWithoutResult(status->tenants.findById(tenantId).orElseThrow().setActive(false));
        mvc.perform(get("/api/project-alerts/options").header("Authorization","Bearer "+adminToken)).andExpect(status().isForbidden());
        send(adminToken,UUID.randomUUID().toString(),payload("BACKLOG","Reminder",overdueId)).andExpect(status().isForbidden());unchanged();
    }
    void allowClassAdministration() {
        tx.executeWithoutResult(status->{var role=roles.findByName("ADMIN").orElseThrow();
            role.getPermissions().add(permissions.findByName("PEO_TEAM_ALLOCATE").orElseThrow());roles.saveAndFlush(role);
            adminToken=token(users.findById(adminId).orElseThrow());});
    }
    @Test void managedClassesUseExistingStudentsEvenBeforeTeamsArePublished() throws Exception {
        Long[] ids=new Long[2];
        tx.executeWithoutResult(status->{
            var tenant=tenants.saveAndFlush(Tenant.builder().code("EXISTING-"+UUID.randomUUID()).name("Existing training data").build());
            var c=schoolClass(tenant.getId(),301L,401L,null);ids[0]=c.getId();ids[1]=tenant.getId();
            for(int i=0;i<2;i++){var student=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Existing student "+i);
                student.setLocked(true);users.saveAndFlush(student);
                var cm=new ClassMember();cm.setTrainingClass(c);cm.setUser(student);cm.setStatus(ClassMemberStatus.ACTIVE);classMembers.saveAndFlush(cm);}
        });
        long oldUsers=users.count(),oldTeams=teams.count(),oldMembers=members.count();
        allowClassAdministration();
        var response=mvc.perform(get("/api/project-alerts/options").header("Authorization","Bearer "+adminToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var selected=json.readTree(response).get("classes").findValues("id");
        assertThat(selected).anyMatch(id->id.asLong()==ids[0]);
        JsonNode c=null;for(var row:json.readTree(response).get("classes"))if(row.get("id").asLong()==ids[0])c=row;
        assertThat(c).isNotNull();assertThat(c.get("studentCount").asInt()).isEqualTo(2);assertThat(c.get("teamCount").asInt()).isZero();
        for(String section:List.of("backlog","milestones","inactive-members"))mvc.perform(get("/api/project-alerts/"+section)
                .param("classId",ids[0].toString()).header("Authorization","Bearer "+adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/project-alerts/backlog").param("classId",ids[0].toString()).header("Authorization","Bearer "+mentorToken)).andExpect(status().isForbidden());
        assertThat(users.count()).isEqualTo(oldUsers);assertThat(teams.count()).isEqualTo(oldTeams);assertThat(members.count()).isEqualTo(oldMembers);unchanged();
    }
    @Test void globalClassAdminKeepsAlertsAndSubmissionsInTheTargetTeamsTenant() throws Exception {
        Long[] ids=new Long[5];UUID[] mid=new UUID[1];
        tx.executeWithoutResult(status->{
            var tenant=tenants.saveAndFlush(Tenant.builder().code("MANAGED-"+UUID.randomUUID()).name("Managed tenant").build());ids[0]=tenant.getId();
            var p=new Project();p.setTenant(tenant);p.setCode("MANAGED-"+UUID.randomUUID());p.setName("Managed project");p.setStatus(ProjectStatus.ACTIVE);p=projects.saveAndFlush(p);
            var c=schoolClass(tenant.getId(),501L,601L,null);var team=team(c,p);ids[1]=team.getId();ids[2]=c.getId();
            var student=user(tenant,roles.findByName("STUDENT").orElseThrow(),"Managed student");var member=member(team,student,"DEV",8);
            student.setLocked(true);users.saveAndFlush(student);
            var sprint=sprints.saveAndFlush(Sprint.builder().teamId(team.getId()).projectId(p.getId()).name("Managed sprint")
                    .startDate(LocalDateTime.now().minusDays(10)).endDate(LocalDateTime.now().plusDays(3)).build());
            var item=item(sprint,member.getId(),"Managed backlog task",SprintBacklogStatus.TODO,now.minusSeconds(3600));ids[3]=item.getId();ids[4]=item.getVersion();
            var m=Milestone.create(tenant.getId(),p.getId(),team.getId(),"Managed milestone",null,now.plusSeconds(3600),true,UUID.randomUUID(),null,
                    LatePolicyType.NO_LATE,null,null,UUID.randomUUID(),now);m.openForWork(UUID.randomUUID(),now);m=milestones.saveAndFlush(m);mid[0]=m.getId();
            submissions.saveAndFlush(com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission.submit(
                    tenant.getId(),null,team.getId(),m.getId(),UUID.nameUUIDFromBytes(student.getEmail().getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                    1,"https://example.test/repo",null,null,"{}","[]",now.minusSeconds(10),false,null));
        });
        allowClassAdministration();
        list("backlog",adminToken,ids[1]).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        list("milestones",adminToken,ids[1]).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].canSend").value(true));
        mvc.perform(get("/api/teams/{id}/milestones",ids[1]).header("Authorization","Bearer "+adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].title").value("Managed milestone"));
        mvc.perform(get("/api/teams/{id}/milestones",ids[1]).header("Authorization","Bearer "+mentorToken)).andExpect(status().isForbidden());
        String body=json.writeValueAsString(Map.of("teamId",ids[1],"kind","BACKLOG","warningNote","Please review this task",
                "selections",List.of(Map.of("id",ids[3].toString(),"version",ids[4]))));
        var result=send(adminToken,UUID.randomUUID().toString(),body).andExpect(status().isAccepted()).andReturn();
        UUID batch=UUID.fromString(json.readTree(result.getResponse().getContentAsString()).get("batchId").asText());
        assertThat(batches.findById(batch).orElseThrow().getTenantId()).isEqualTo(ids[0]);
        assertThat(json.readTree(outbox.findById(batch).orElseThrow().getPayloadJson()).get("tenant_id").asLong()).isEqualTo(ids[0]);
        mvc.perform(get("/api/project-alerts/teams/{id}/history",ids[1]).param("kind","BACKLOG").header("Authorization","Bearer "+adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        list("backlog",mentorToken,ids[1]).andExpect(status().isForbidden());
        send(mentorToken,UUID.randomUUID().toString(),body).andExpect(status().isForbidden());
        tx.executeWithoutResult(status->tenants.findById(ids[0]).orElseThrow().setActive(false));
        list("backlog",adminToken,ids[1]).andExpect(status().isForbidden());
    }
    @Test void teamCanBeMonitoredBeforeAProjectExists() throws Exception {
        tx.executeWithoutResult(status->{
            teams.findById(teamId).orElseThrow().setProject(null);
            sprints.findById(sprintId).orElseThrow().setProjectId(null);
        });
        list("backlog",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].team.projectId").isEmpty());
        send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","Reminder",overdueId)).andExpect(status().isAccepted());
    }
    @Test void simultaneousInactiveRemindersRespectSharedCooldown() throws Exception {
        String body=memberPayload("Concurrent reminder",aId);var gate=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<Integer> request=()->{gate.await();return send(mentorToken,UUID.randomUUID().toString(),body).andReturn().getResponse().getStatus();};
            var a=executor.submit(request);var b=executor.submit(request);gate.countDown();
            assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(202,422);
        }
        assertThat(batches.count()).isEqualTo(oldBatches+1);assertThat(outbox.count()).isEqualTo(oldEvents+1);
    }
    ResultActions submitArtifact(String key,String note) throws Exception {
        return mvc.perform(post("/api/teams/{team}/milestones/{milestone}/artifact-draft/submissions",teamId,milestoneId)
                .header("Authorization","Bearer "+studentToken).header("Idempotency-Key",key).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("repositoryUrl","https://example.com/repository","releaseNotes",note,"checklist",Map.of(),"attachmentIds",List.of()))));
    }
    @Test void existingRosterContextRepairRetainsIdsLocksAndMembershipAndRunsOnce() {
        Long[] ids=new Long[3];String[] code=new String[1];
        tx.executeWithoutResult(status->{
            var c=schoolClass(99999991L,701L,801L,null);ids[0]=c.getId();code[0]=c.getCode();
            var student=user(null,roles.findByName("STUDENT").orElseThrow(),"Existing locked student");student.setLocked(true);users.saveAndFlush(student);ids[1]=student.getId();
            var cm=new ClassMember();cm.setTrainingClass(c);cm.setUser(student);cm.setStatus(ClassMemberStatus.ACTIVE);ids[2]=classMembers.saveAndFlush(cm).getId();
        });
        long userCount=users.count(),teamCount=teams.count(),memberCount=classMembers.count();
        contextRepair.repair(List.of(code[0]),tenantId,adminId);
        assertThat(classes.findById(ids[0]).orElseThrow().getTenantId()).isEqualTo(tenantId);
        assertThat(users.findById(ids[1]).orElseThrow().getTenantId()).isEqualTo(tenantId);
        assertThat(users.findById(ids[1]).orElseThrow().getLocked()).isTrue();
        assertThat(classMembers.findById(ids[2]).orElseThrow().getUser().getId()).isEqualTo(ids[1]);
        contextRepair.repair(List.of(code[0]),tenantId,adminId);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM legacy_class_context_repairs WHERE (entity_type='CLASS' AND entity_id=?) OR (entity_type='USER' AND entity_id=?)",Long.class,ids[0],ids[1])).isEqualTo(2L);
        assertThat(users.count()).isEqualTo(userCount);assertThat(teams.count()).isEqualTo(teamCount);assertThat(classMembers.count()).isEqualTo(memberCount);unchanged();
    }
    @Test void rosterContextRepairDoesNotMoveAnExistingTenantOrGuessConflictingMembership() {
        String[] code=new String[1];Long[] ids=new Long[3];
        tx.executeWithoutResult(status->{
            var foreign=tenants.saveAndFlush(Tenant.builder().code("VALID-"+UUID.randomUUID()).name("Valid tenant").build());ids[0]=foreign.getId();
            var c=schoolClass(foreign.getId(),701L,801L,null);ids[1]=c.getId();code[0]=c.getCode();
            var student=user(null,roles.findByName("STUDENT").orElseThrow(),"Ambiguous roster");ids[2]=student.getId();
            for(var actual:List.of(c,classes.findById(classId).orElseThrow())){var cm=new ClassMember();cm.setTrainingClass(actual);cm.setUser(student);cm.setStatus(ClassMemberStatus.ACTIVE);classMembers.saveAndFlush(cm);}
        });
        contextRepair.repair(List.of(code[0]),tenantId,adminId);
        assertThat(classes.findById(ids[1]).orElseThrow().getTenantId()).isEqualTo(ids[0]);
        assertThat(users.findById(ids[2]).orElseThrow().getTenantId()).isNull();unchanged();
    }
    @Test void artifactSubmissionDoesNotSuppressAnIndependentMilestoneProgressAlert() throws Exception {
        links(mentorToken,overdueId,doneId).andExpect(status().isOk());
        submitArtifact(UUID.randomUUID().toString(),"On-time hand-in").andExpect(status().isCreated());
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].progress.percentage").value(50))
                .andExpect(jsonPath("$.content[0].canSend").value(true));
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(2));
        send(mentorToken,UUID.randomUUID().toString(),milestonePayload()).andExpect(status().isAccepted());
        when(clock.instant()).thenReturn(now.plus(Duration.ofDays(2)));
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.total").value(0));
    }
    @Test void pastDeadlineMilestonesAreExcludedAndCannotReceiveRiskAlerts() throws Exception {
        jdbc.update("UPDATE milestones SET deadline=? WHERE milestone_id=?",java.sql.Timestamp.from(now.minusSeconds(1)),milestoneId);
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        send(mentorToken,UUID.randomUUID().toString(),milestonePayload()).andExpect(status().isConflict());unchanged();
    }
    @Test void submittedVersionsDoNotResetTaskStartInactivityOrCompleteTheMilestone() throws Exception {
        links(mentorToken,overdueId,doneId).andExpect(status().isOk());
        submitArtifact(UUID.randomUUID().toString(),"First hand-in").andExpect(status().isCreated());
        submitArtifact(UUID.randomUUID().toString(),"Second hand-in").andExpect(status().isCreated());
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(2));
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.content[0].progress.percentage").value(50));
        assertThat(milestones.findById(milestoneId).orElseThrow().getStatus()).isEqualTo(MilestoneStatus.OPEN);
        assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.ACTIVE);
    }
    @Test void realArtifactDraftEditsDoNotResetTaskStartInactivity() throws Exception {
        String body=json.writeValueAsString(Map.of("repositoryUrl","https://example.com/repository","releaseNotes","Preparing the submission","checklist",Map.of()));
        var request=put("/api/teams/{team}/milestones/{milestone}/artifact-draft",teamId,milestoneId)
                .header("Authorization","Bearer "+studentToken).contentType(MediaType.APPLICATION_JSON).content(body);
        mvc.perform(request).andExpect(status().isOk());long logs=milestoneAudits.count(),events=outbox.count();
        mvc.perform(request).andExpect(status().isOk());assertThat(milestoneAudits.count()).isEqualTo(logs);assertThat(outbox.count()).isEqualTo(events);
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].submission").doesNotExist());
    }
    @Test void rejectedLateSubmissionDoesNotResetInactivityOrQueueEvents() throws Exception {
        jdbc.update("UPDATE milestones SET deadline=? WHERE milestone_id=?",now.minus(Duration.ofDays(1)),milestoneId);
        long count=submissions.count(),logs=milestoneAudits.count();
        submitArtifact(UUID.randomUUID().toString(),"Too late").andExpect(status().isUnprocessableEntity());
        assertThat(submissions.count()).isEqualTo(count);assertThat(milestoneAudits.count()).isEqualTo(logs);unchanged();
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        jdbc.update("UPDATE milestones SET late_policy_type='ALLOW_LATE',late_until=?,late_penalty_percent=10 WHERE milestone_id=?",now.plus(Duration.ofDays(1)),milestoneId);
        submitArtifact(UUID.randomUUID().toString(),"Accepted according to the late policy").andExpect(status().isCreated())
                .andExpect(jsonPath("$.submittedLate").value(true)).andExpect(jsonPath("$.status").value("SUBMITTED"));
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.ACTIVE);
    }
    @Test void reviewerEventsAndForeignSubmissionRowsDoNotCountAsStudentContributions() throws Exception {
        tx.executeWithoutResult(status->{
            var actor=UUID.nameUUIDFromBytes(users.findById(aId).orElseThrow().getEmail().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            milestoneAudits.save(com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog.artifactEvent(
                    milestoneId,projectId,tenantId,actor,"ARTIFACT_REVIEWED","review","{}",now.minusSeconds(5)));
            submissions.save(com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission.submit(
                    tenantId,projectId,otherTeamId,milestoneId,actor,1,"https://example.com/repository",null,null,"{}","[]",now.minusSeconds(5),false,null));
        });
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].submission").doesNotExist());
    }
    @Test void actualRosterProtectsArtifactSubmissionAndReviewerLists() throws Exception {
        mvc.perform(post("/api/teams/{team}/milestones/{milestone}/artifact-draft/submissions",otherTeamId,milestoneId)
                .header("Authorization","Bearer "+studentToken).header("Idempotency-Key",UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"repositoryUrl\":\"https://example.com/repository\"}")).andExpect(status().isForbidden());
        String teacher=tx.execute(status->token(user(tenants.findById(tenantId).orElseThrow(),roles.findByName("TEACHER").orElseThrow(),"Unassigned teacher")));
        mvc.perform(get("/api/teams/{team}/milestones/submissions",teamId).header("Authorization","Bearer "+teacher)).andExpect(status().isForbidden());
        mvc.perform(get("/api/teams/{team}/milestones/submissions",teamId).header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk());
        unchanged();
    }
    @Test void closedProjectsStopAllNewAlertsAndKeepHistoryAndIdempotentResults() throws Exception {
        String key=UUID.randomUUID().toString(),body=payload("BACKLOG","Original queued alert",overdueId);
        String original=send(mentorToken,key,body).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        long events=outbox.count(),count=batches.count();
        for(var state:List.of(ProjectStatus.COMPLETED,ProjectStatus.CANCELLED)) {
            tx.executeWithoutResult(status->projects.findById(projectId).orElseThrow().setStatus(state));
            for(String kind:List.of("backlog","milestones","inactive-members"))list(kind,mentorToken,teamId)
                    .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
            send(mentorToken,UUID.randomUUID().toString(),body).andExpect(status().isConflict());
            send(mentorToken,key,body).andExpect(status().isAccepted()).andExpect(content().json(original));
            links(mentorToken,overdueId).andExpect(status().isConflict());
            mvc.perform(get("/api/project-alerts/teams/{team}/history",teamId).param("kind","BACKLOG").header("Authorization","Bearer "+mentorToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
            assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(state);
        }
        assertThat(outbox.count()).isEqualTo(events);assertThat(batches.count()).isEqualTo(count);
    }
    @Test void projectArtifactRouteSharesTheSameTenantAndSubmissionContextAsTeamWorkspace() throws Exception {
        mvc.perform(post("/api/projects/{project}/milestones/{milestone}/artifact-draft/submissions",projectId,milestoneId)
                .header("Authorization","Bearer "+studentToken).header("Idempotency-Key",UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"repositoryUrl\":\"https://example.com/repository\"}")).andExpect(status().isCreated());
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].canSend").value(true));
        tx.executeWithoutResult(status->projects.findById(projectId).orElseThrow().setStatus(ProjectStatus.PLANNING));
        mvc.perform(post("/api/projects/{project}/milestones/{milestone}/artifact-draft/submissions",projectId,milestoneId)
                .header("Authorization","Bearer "+studentToken).header("Idempotency-Key",UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"repositoryUrl\":\"https://example.com/repository\"}")).andExpect(status().isConflict());
    }
    @Test void actualBoardDescriptionEditsDoNotResetTaskStartInactivity() throws Exception {
        tx.executeWithoutResult(status->{
            for(Long userId:List.of(aId,mentorId))em.persist(BoardProjectMember.builder().projectId(projectId).userId(userId)
                    .projectRole(userId.equals(mentorId)?com.example.starter_project_2025.system.project.team.ProjectRole.MENTOR
                            :com.example.starter_project_2025.system.project.team.ProjectRole.MEMBER).build());
        });
        String created=mvc.perform(post("/api/projects/{project}/sprints/{sprint}/tasks",projectId,sprintId)
                .header("Authorization","Bearer "+mentorToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Real Board task without an assignee\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        Long taskId=json.readTree(created).get("id").asLong();
        long count=activity.count();
        // Looking at the Board, and saving exactly the current values, are not contributions.
        mvc.perform(get("/api/projects/{project}/tasks",projectId).header("Authorization","Bearer "+studentToken))
                .andExpect(status().isOk());
        mvc.perform(put("/api/projects/{project}/tasks/{task}",projectId,taskId)
                .header("Authorization","Bearer "+studentToken).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        assertThat(activity.count()).isEqualTo(count);
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(2));

        String edit="{\"description\":\"Student records actual implementation work\"}";
        mvc.perform(put("/api/projects/{project}/tasks/{task}",projectId,taskId)
                .header("Authorization","Bearer "+studentToken).contentType(MediaType.APPLICATION_JSON).content(edit))
                .andExpect(status().isOk());
        assertThat(activity.count()).isEqualTo(count+1);
        var audit=activity.findByProjectIdOrderByOccurredAtDesc(projectId,org.springframework.data.domain.PageRequest.of(0,10))
                .stream().filter(row->"TASK_UPDATED".equals(row.getActionType())).findFirst().orElseThrow();
        assertThat(audit.getActorId()).isEqualTo(aId);
        assertThat(json.readTree(audit.getBeforeState()).get("description").isNull()).isTrue();
        assertThat(json.readTree(audit.getAfterState()).get("description").asText()).contains("actual implementation");
        mvc.perform(put("/api/projects/{project}/tasks/{task}",projectId,taskId)
                .header("Authorization","Bearer "+studentToken).contentType(MediaType.APPLICATION_JSON).content(edit))
                .andExpect(status().isOk());
        assertThat(activity.count()).isEqualTo(count+1);
        list("inactive-members",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        assertThat(currentMember(aId).get("inactive").asBoolean()).isTrue();
        // Board tasks are activity evidence, never extra parent items in the deadline list.
        list("backlog",mentorToken,teamId).andExpect(jsonPath("$.total").value(1));
        Long version=tx.execute(status->em.find(com.example.starter_project_2025.system.project.sprint.Task.class,taskId).getVersion());
        mvc.perform(patch("/api/projects/{project}/tasks/{task}/status",projectId,taskId).header("Authorization","Bearer "+studentToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("status","IN_PROGRESS","expectedVersion",version))))
                .andExpect(status().isOk());
        assertThat(backlogs.findById(overdueId).orElseThrow().getStatus()).isEqualTo(SprintBacklogStatus.TODO);
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].id").value(bId.toString()));
        send(mentorToken,UUID.randomUUID().toString(),memberPayload("Stale selection",aId)).andExpect(status().isConflict());
        assertThat(batches.count()).isEqualTo(oldBatches);
    }

    @Test void completingBacklogsRemovesMilestoneAlertAndEditsDoNotResetTaskStarts() throws Exception {
        links(mentorToken,overdueId,doneId).andExpect(status().isOk());
        tx.executeWithoutResult(status->item(sprints.findById(sprintId).orElseThrow(),aMembershipId,"Other waiting work",SprintBacklogStatus.TODO,null));
        mvc.perform(put("/api/sprint-backlogs/{id}",overdueId).header("Authorization","Bearer "+mentorToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"DONE\",\"isActive\":true}")).andExpect(status().isOk());
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.total").value(0));
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(2));
        mvc.perform(put("/api/sprint-backlogs/{id}",doneId).header("Authorization","Bearer "+mentorToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"description\":\"Updated notes\",\"isActive\":true}")).andExpect(status().isOk());
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(2));
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.total").value(0));unchanged();
    }

    @Test void conflictingSprintProjectCannotLeakWorkProgressOrContributionIntoTheTeam() throws Exception {
        links(mentorToken,overdueId,doneId).andExpect(status().isOk());
        tx.executeWithoutResult(status->{
            var project=new Project();project.setTenant(tenants.findById(tenantId).orElseThrow());
            project.setCode("OTHER-"+UUID.randomUUID());project.setName("Another project");project.setStatus(ProjectStatus.ACTIVE);
            sprints.findById(sprintId).orElseThrow().setProjectId(projects.saveAndFlush(project).getId());
        });
        tx.executeWithoutResult(status->{
            var item=backlogs.findById(overdueId).orElseThrow();
            em.persist(com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog.builder()
                    .sprintBacklogId(item.getId()).sprintId(sprintId).action("UPDATE").actorId(aId)
                    .actorEmail("test-only").beforeState("TODO").afterState("IN_PROGRESS").correlationId("wrong-project").build());
        });
        list("backlog",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        var view=milestoneView(mentorToken);
        assertThat(view.get("progress").get("total").asInt()).isZero();
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(1));
        send(mentorToken,UUID.randomUUID().toString(),payload("BACKLOG","Wrong project",overdueId)).andExpect(status().isConflict());
        unchanged();
    }

    @Test void projectBoundMilestoneAndItsArtifactsMustMatchTheCurrentTeamProject() throws Exception {
        submitArtifact(UUID.randomUUID().toString(),"Artifact for the previous project").andExpect(status().isCreated());
        long events=outbox.count();
        tx.executeWithoutResult(status->{
            var project=new Project();project.setTenant(tenants.findById(tenantId).orElseThrow());
            project.setCode("NEXT-"+UUID.randomUUID());project.setName("Current team project");project.setStatus(ProjectStatus.ACTIVE);
            teams.findById(teamId).orElseThrow().setProject(projects.saveAndFlush(project));
        });
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/project-alerts/teams/{team}/milestones/{milestone}/backlog-items",teamId,milestoneId)
                .header("Authorization","Bearer "+mentorToken)).andExpect(status().isNotFound());
        send(mentorToken,UUID.randomUUID().toString(),milestonePayload()).andExpect(status().isNotFound());
        assertThat(outbox.count()).isEqualTo(events);assertThat(batches.count()).isEqualTo(oldBatches);
    }

    @Test void actualUuidTaskApiUsesTheProjectBridgeAndIgnoresTechnicalOnlyAuditChanges() throws Exception {
        UUID projectAlias=UUID.randomUUID(),memberAlias=UUID.randomUUID();
        mvc.perform(put("/api/task-alerts/project-links/{alias}",projectAlias).header("Authorization","Bearer "+adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("projectId",projectId))))
                .andExpect(status().isOk());
        mvc.perform(put("/api/task-alerts/member-links/{alias}",memberAlias).header("Authorization","Bearer "+adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("projectId",projectAlias,
                        "source","PROJECT_MEMBER","sourceMemberId",aMembershipId)))).andExpect(status().isOk());
        tx.executeWithoutResult(status->roles.findByName("STUDENT").orElseThrow().getPermissions()
                .add(permissions.findByName("TASK_UPDATE").orElseThrow()));
        var created=json.readTree(mvc.perform(post("/api/tasks").header("Authorization","Bearer "+mentorToken)
                .header("Idempotency-Key",UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectId",projectAlias,"assigneeProjectMemberId",memberAlias,
                        "title","Shared UUID task","estimatedHours",2,"isActive",true))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(2));
        var unchanged=(com.fasterxml.jackson.databind.node.ObjectNode)created.deepCopy();
        var saved=json.readTree(mvc.perform(put("/api/tasks/{id}",created.get("id").asText())
                .header("Authorization","Bearer "+studentToken).header("Idempotency-Key",UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON).content(unchanged.toString()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        // Task CRUD may record a new version/updatedBy even for the same business fields.
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(2));
        var inProgress=json.readTree(mvc.perform(patch("/api/tasks/{id}/status",created.get("id").asText())
                .header("Authorization","Bearer "+studentToken).header("Idempotency-Key",UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "status","IN_PROGRESS","version",saved.get("version").asLong()))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].id").value(bId.toString()));
        var changed=(com.fasterxml.jackson.databind.node.ObjectNode)inProgress.deepCopy();
        changed.put("description","Student changed the implementation");
        mvc.perform(put("/api/tasks/{id}",created.get("id").asText())
                .header("Authorization","Bearer "+studentToken).header("Idempotency-Key",UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON).content(changed.toString())).andExpect(status().isOk());
        list("inactive-members",mentorToken,teamId).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].id").value(bId.toString()));
        list("backlog",mentorToken,teamId).andExpect(jsonPath("$.total").value(1));
        assertThat(batches.count()).isEqualTo(oldBatches);
    }

    ResultActions memberResults(String token,Long team,Long user) throws Exception {
        var request=get("/api/project-alerts/teams/{team}/members/{user}/work-results",team,user);
        if(token!=null)request.header("Authorization","Bearer "+token);
        return mvc.perform(request);
    }
    JsonNode currentMember(Long userId) throws Exception {
        String body=mvc.perform(get("/api/project-alerts/inactive-members").param("teamId",teamId.toString()).param("inactiveOnly","false")
                .header("Authorization","Bearer "+mentorToken)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        for(var row:json.readTree(body).get("content"))if(row.get("id").asLong()==userId)return row;
        throw new AssertionError("Expected current member "+userId);
    }
    @Test void workResultsNeverChangeInactivityOrApplyTheTeamRiskThresholdToAnIndividual() throws Exception {
        var inactive=currentMember(aId);
        assertThat(inactive.get("inactive").asBoolean()).isTrue();
        assertThat(inactive.get("workResults").get("assigned").asInt()).isEqualTo(3);
        assertThat(inactive.get("workResults").get("done").asInt()).isEqualTo(1);
        assertThat(inactive.get("workResults").get("overdue").asInt()).isEqualTo(1);
        assertThat(inactive.get("workResults").get("percentage").decimalValue()).isEqualByComparingTo("33.33");
        recordStart(aId,doneId,now.minusSeconds(5));
        var active=currentMember(aId);
        assertThat(active.get("activityStatus").asText()).isEqualTo("ACTIVE");
        assertThat(active.get("canSend").asBoolean()).isFalse();
        assertThat(active.get("workResults")).isEqualTo(inactive.get("workResults"));
        // Low completion still permits no inactivity reminder to this recently active member.
        send(mentorToken,UUID.randomUUID().toString(),memberPayload("Review work separately",aId)).andExpect(status().isConflict());
        var empty=currentMember(bId);
        assertThat(empty.get("inactive").asBoolean()).isTrue();assertThat(empty.get("canSend").asBoolean()).isTrue();
        assertThat(empty.get("workResults").get("assigned").asInt()).isZero();
        assertThat(empty.get("workResults").get("percentage").isNull()).isTrue();
        memberResults(mentorToken,teamId,bId).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.summary.percentage").isEmpty());unchanged();
    }
    @Test void memberWorkResultsUseCurrentTeamAssignmentsAndSeparateReviewAndUndatedWork() throws Exception {
        tx.executeWithoutResult(status->{
            var sprint=sprints.findById(sprintId).orElseThrow();
            item(sprint,aMembershipId,"Awaiting review",SprintBacklogStatus.REVIEW,now.minusSeconds(3600));
            item(sprint,aMembershipId,"Unscheduled work",SprintBacklogStatus.TODO,null);
            item(sprint,aMembershipId,"Deleted work",SprintBacklogStatus.TODO,now.minusSeconds(1)).setIsActive(false);
            item(sprint,null,"Unassigned work",SprintBacklogStatus.TODO,now.minusSeconds(1));
            var other=sprints.saveAndFlush(Sprint.builder().teamId(otherTeamId).name("Other team's sprint "+UUID.randomUUID()).build());
            item(other,aMembershipId,"Work outside the team",SprintBacklogStatus.TODO,now.minusSeconds(1));
        });
        String body=memberResults(mentorToken,teamId,aId).andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.assigned").value(5)).andExpect(jsonPath("$.summary.done").value(1))
                .andExpect(jsonPath("$.summary.overdue").value(1)).andExpect(jsonPath("$.summary.inReview").value(1))
                .andExpect(jsonPath("$.summary.withoutDeadline").value(1)).andExpect(jsonPath("$.summary.percentage").value(20))
                .andExpect(jsonPath("$.items.length()").value(5)).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("Deleted work","Unassigned work","Work outside the team");
        for(String field:List.of("email","password","token","score","feedback"))assertThat(json.readTree(body).findValues(field)).isEmpty();
        unchanged();
    }
    @Test void workResultsRefreshFromBacklogEditsAndReassignmentWithoutChangingActivityRules() throws Exception {
        Long bMembership=tx.execute(status->members.findByTeam_IdAndClassMember_User_Id(teamId,bId).orElseThrow().getId());
        memberResults(mentorToken,teamId,aId).andExpect(jsonPath("$.summary.assigned").value(3));
        mvc.perform(put("/api/sprint-backlogs/{id}",overdueId).header("Authorization","Bearer "+mentorToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("isActive",true,
                        "status","DONE","assigneeProjectMemberId",bMembership)))).andExpect(status().isOk());
        memberResults(mentorToken,teamId,aId).andExpect(jsonPath("$.summary.assigned").value(2))
                .andExpect(jsonPath("$.summary.percentage").value(50));
        memberResults(mentorToken,teamId,bId).andExpect(jsonPath("$.summary.assigned").value(1))
                .andExpect(jsonPath("$.summary.done").value(1)).andExpect(jsonPath("$.summary.overdue").value(0))
                .andExpect(jsonPath("$.summary.percentage").value(100));
        assertThat(currentMember(bId).get("inactive").asBoolean()).isTrue();unchanged();
    }
    @Test void workResultsRequireBothBacklogAndMemberDetailPermissionAndDoNotLeakThroughMemberList() throws Exception {
        for(String permission:List.of("SPRINT_BACKLOG_READ","WORKSPACE_MEMBER_READ")) {
            tx.executeWithoutResult(status->roles.findById(mentorRoleId).orElseThrow().getPermissions()
                    .removeIf(p->permission.equals(p.getName())));
            assertThat(currentMember(aId).get("workResults").isNull()).isTrue();
            memberResults(mentorToken,teamId,aId).andExpect(status().isForbidden());
            tx.executeWithoutResult(status->roles.findById(mentorRoleId).orElseThrow().getPermissions()
                    .add(permissions.findByName(permission).orElseThrow()));
        }
        unchanged();
    }
    @Test void memberWorkResultsAreReadOnlyAndCheckSessionTeamScopeAndCurrentRoster() throws Exception {
        long work=backlogs.count(),roster=members.count(),logs=activity.count();
        memberResults(null,teamId,aId).andExpect(status().isUnauthorized());
        memberResults(mentorToken,otherTeamId,aId).andExpect(status().isForbidden());
        memberResults(mentorToken,teamId,mentorId).andExpect(status().isNotFound());
        memberResults(mentorToken,teamId,aId).andExpect(status().isOk());
        memberResults(mentorToken,teamId,aId).andExpect(status().isOk());
        assertThat(backlogs.count()).isEqualTo(work);assertThat(members.count()).isEqualTo(roster);
        assertThat(activity.count()).isEqualTo(logs);
        assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.ACTIVE);
        tx.executeWithoutResult(status->members.findById(aMembershipId).orElseThrow().setIsActive(false));
        memberResults(mentorToken,teamId,aId).andExpect(status().isNotFound());unchanged();
    }

    @Test void parallelRetriesWithSameKeyQueueOneBatch() throws Exception {
        String key=UUID.randomUUID().toString(),body=payload("BACKLOG","Concurrent",overdueId);var gate=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<String> request=()->{gate.await();return send(mentorToken,key,body).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();};
            var a=executor.submit(request);var b=executor.submit(request);gate.countDown();assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
        }
        assertThat(batches.count()).isEqualTo(oldBatches+1);assertThat(outbox.count()).isEqualTo(oldEvents+1);
    }
    @Test void threeOfFiveBacklogsAlertAndExactlyEightyPercentDisappearsAndCannotSend() throws Exception {
        tx.executeWithoutResult(status->{var m=milestones.findById(milestoneId).orElseThrow();var sprint=sprints.findById(sprintId).orElseThrow();
            for(Long id:List.of(overdueId,upcomingId,doneId))backlogs.findById(id).orElseThrow().setMilestone(m);
            item(sprint,null,"Completed fourth",SprintBacklogStatus.DONE,null).setMilestone(m);
            item(sprint,null,"Completed fifth",SprintBacklogStatus.DONE,null).setMilestone(m);});
        list("milestones",mentorToken,teamId).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].progress.done").value(3)).andExpect(jsonPath("$.content[0].progress.total").value(5))
                .andExpect(jsonPath("$.content[0].progress.percentage").value(60));
        String stale=milestonePayload();
        tx.executeWithoutResult(status->backlogs.findById(upcomingId).orElseThrow().setStatus(SprintBacklogStatus.DONE));
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.total").value(0));
        send(mentorToken,UUID.randomUUID().toString(),stale).andExpect(status().isConflict());unchanged();
    }
    @Test void milestoneWindowIsFixedAtFortyEightHoursAndClosedMilestonesAreExcluded() throws Exception {
        jdbc.update("update milestones set deadline=? where milestone_id=?",java.sql.Timestamp.from(now.plus(Duration.ofHours(48))),milestoneId);
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.total").value(1));
        mvc.perform(get("/api/project-alerts/milestones").param("teamId",teamId.toString()).param("windowHours","24")
                .header("Authorization","Bearer "+mentorToken)).andExpect(jsonPath("$.total").value(1));
        jdbc.update("update milestones set deadline=? where milestone_id=?",java.sql.Timestamp.from(now.plus(Duration.ofHours(48)).plusSeconds(1)),milestoneId);
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.total").value(0));
        jdbc.update("update milestones set deadline=?,status='CLOSED' where milestone_id=?",java.sql.Timestamp.from(now.plusSeconds(3600)),milestoneId);
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.total").value(0));unchanged();
    }
    @Test void membersWithoutTodoAssignmentsAreNotInactiveAndNewAssignmentsReceiveSevenDays() throws Exception {
        jdbc.update("update sprint_backlog set created_at=? where sprint_backlog_id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(7)).plusSeconds(1)),overdueId);
        assertThat(currentMember(aId).get("inactive").asBoolean()).isFalse();
        jdbc.update("update sprint_backlog set created_at=? where sprint_backlog_id=?",java.sql.Timestamp.from(now.minus(Duration.ofDays(7))),overdueId);
        assertThat(currentMember(aId).get("inactive").asBoolean()).isTrue();
        tx.executeWithoutResult(status->backlogs.findById(overdueId).orElseThrow().setStatus(SprintBacklogStatus.DONE));
        assertThat(currentMember(aId).get("inactive").asBoolean()).isFalse();
        send(mentorToken,UUID.randomUUID().toString(),memberPayload("No pending work",aId)).andExpect(status().isConflict());unchanged();
    }
    @Test void recentReassignmentOfOldTodoWorkStartsANewGracePeriod() throws Exception {
        tx.executeWithoutResult(status->{var event=com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog.builder()
                .sprintBacklogId(overdueId).sprintId(sprintId).actorId(mentorId).action("UPDATE").beforeState("{\"assigneeProjectMemberId\":999999}")
                .afterState("{\"assigneeProjectMemberId\":"+aMembershipId+"}").correlationId("assignment").build();em.persist(event);em.flush();
            jdbc.update("update sprint_backlog_audit_log set created_at=? where id=?",java.sql.Timestamp.from(now.minusSeconds(10)),event.getId());});
        assertThat(currentMember(aId).get("inactive").asBoolean()).isFalse();unchanged();
    }
    @Test void backgroundMonitorDetectsAllThreeCategoriesWithoutSendingAnyNotifications() throws Exception {
        tx.executeWithoutResult(status->{var m=milestones.findById(milestoneId).orElseThrow();backlogs.findById(overdueId).orElseThrow().setMilestone(m);});
        monitor.scan(now,ZoneId.of("Asia/Ho_Chi_Minh"));
        var snapshot=monitor.latest(teamId).orElseThrow();assertThat(snapshot.checkedAt()).isEqualTo(now);
        assertThat(snapshot.overdueBacklogs()).containsExactly(overdueId);assertThat(snapshot.milestones()).containsExactly(milestoneId);
        assertThat(snapshot.inactiveMembers()).containsExactlyInAnyOrder(aId,bId);unchanged();
        tx.executeWithoutResult(status->backlogs.findById(overdueId).orElseThrow().setStatus(SprintBacklogStatus.DONE));
        monitor.scan(now.plusSeconds(60),ZoneId.of("Asia/Ho_Chi_Minh"));
        var next=monitor.latest(teamId).orElseThrow();assertThat(next.milestones()).isEmpty();assertThat(next.overdueBacklogs()).isEmpty();unchanged();
    }
    @Test void legacySelectionsMigrateOnceAndLaterUnlinkingIsPreserved() throws Exception {
        tx.executeWithoutResult(status->{var config=new ProjectAlertData.MilestoneConfig();config.setMilestoneId(milestoneId);
            config.setTeamId(teamId);config.setTenantId(tenantId);config.setConfiguredBy(mentorId);config.setConfiguredAt(now);
            config.setBacklogItemIds(new HashSet<>(Set.of(overdueId,doneId)));configs.saveAndFlush(config);});
        legacyMigration.run(new org.springframework.boot.DefaultApplicationArguments());
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.content[0].progress.percentage").value(50));
        tx.executeWithoutResult(status->backlogs.findById(doneId).orElseThrow().setMilestone(null));
        legacyMigration.run(new org.springframework.boot.DefaultApplicationArguments());
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.content[0].progress.total").value(1));unchanged();
    }

    @Test void editingStatusDoesNotRequireAssigningAProductBacklogToASprint() throws Exception {
        tx.executeWithoutResult(status->{var item=backlogs.findById(overdueId).orElseThrow();item.setSprint(null);
            item.setMilestone(milestones.findById(milestoneId).orElseThrow());});
        mvc.perform(put("/api/sprint-backlogs/{id}",overdueId).header("Authorization","Bearer "+mentorToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sprintId").isEmpty());
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.content[0].progress.total").value(1));
    }
    @Test void linkedBacklogCannotBeMovedToAnotherTeamsSprintEvenWithTheSameProject() throws Exception {
        links(mentorToken,overdueId,doneId).andExpect(status().isOk());
        Long wrongSprint=tx.execute(status->sprints.saveAndFlush(Sprint.builder().name("Foreign team "+UUID.randomUUID())
                .teamId(otherTeamId).projectId(projectId).build()).getId());
        mvc.perform(put("/api/sprint-backlogs/{id}",overdueId).header("Authorization","Bearer "+mentorToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("sprintId",wrongSprint,"status","DONE"))))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errors.milestoneId").isArray());
        assertThat(backlogs.findById(overdueId).orElseThrow().getStatus()).isEqualTo(SprintBacklogStatus.TODO);
        list("milestones",mentorToken,teamId).andExpect(jsonPath("$.content[0].progress.percentage").value(50));unchanged();
    }

}
