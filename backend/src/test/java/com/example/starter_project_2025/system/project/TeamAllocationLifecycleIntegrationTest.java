package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.init.SprintBacklogDataInitializer;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.domain.*;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.trainingclass.*;
import com.example.starter_project_2025.system.project.workspace.domain.*;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.*;
import com.fasterxml.jackson.databind.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"app.seed.board.enabled=false","app.seed.team-allocation.enabled=false",
        "app.task-alert.demo.enabled=false","app.member-reminder.demo.enabled=false",
        "app.project-reports.export.worker-enabled=false","milestone.mock.seed-enabled=false","milestone.submission.mock.seed-enabled=false"})
@ActiveProfiles({"test","artifact-real-scope"})
@AutoConfigureMockMvc
class TeamAllocationLifecycleIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired RoleRepository roles;
    @Autowired UserDetailsService details;
    @Autowired RefreshTokenService tokens;
    @Autowired ProjectRepository projects;
    @MockBean SprintBacklogDataInitializer legacySeed;
    Long tenantId,classId,sessionId,teamId,projectId,workspaceId,templateId,memberId,leaderId;
    String admin,student;

    User user(Tenant tenant,String role,String label) {
        var user=new User();user.setEmail(UUID.randomUUID()+"@allocation.test");user.setPasswordHash("unused");
        user.setFirstName(label);user.setLastName("Test");user.setUserCode("A-"+UUID.randomUUID());user.setTenant(tenant);
        user.setRoles(new HashSet<>(Set.of(roles.findByName(role).orElseThrow())));em.persist(user);em.flush();return user;
    }
    String token(User user) {
        var principal=details.loadUserByUsername(user.getEmail());
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()));
    }
    @BeforeEach void setup() {
        tx.executeWithoutResult(status->{
            var tenant=Tenant.builder().code("ALLOC-"+UUID.randomUUID()).name("Allocation lifecycle").build();em.persist(tenant);em.flush();tenantId=tenant.getId();
            admin=token(user(tenant,"ADMIN","Admin"));
            var mentor=user(tenant,"TEACHER","Mentor");
            var learner=user(tenant,"STUDENT","Learner");student=token(learner);
            var school=new TrainingClass();school.setTenantId(tenantId);school.setProgramId(1L);school.setProgramName("Java");
            school.setCode("ALLOC-"+UUID.randomUUID());school.setName("Allocation lifecycle");school.setStatus(TrainingClassStatus.ONGOING);school.setMentorId(mentor.getId());em.persist(school);em.flush();classId=school.getId();
            var template=new ProjectTemplate();template.setTenantId(tenantId);template.setName("Assigned project");
            template.setStatus(ProjectTemplateStatus.ACTIVE);template.setConstraintsJson("{\"min_members\":1,\"max_members\":5}");em.persist(template);em.flush();templateId=template.getId();
            var session=new TeamAllocationSession();session.setTrainingClass(school);session.setProjectTemplate(template);
            session.setStatus(TeamAllocationSessionStatus.OPEN);session.setMaxMembers(5);em.persist(session);em.flush();sessionId=session.getId();
            var team=new ProjectTeam();team.setTrainingClass(school);team.setAllocationSession(session);team.setTeamName("Draft team");
            team.setStatus(ProjectTeamStatus.DRAFT);team.setMaxMembers(5);team.setProjectTemplate(template);em.persist(team);em.flush();teamId=team.getId();
            var cm=new ClassMember();cm.setTrainingClass(school);cm.setUser(learner);cm.setStatus(ClassMemberStatus.ACTIVE);em.persist(cm);em.flush();leaderId=cm.getId();
            var member=new ProjectMember();member.setTeam(team);member.setClassMember(cm);member.setRole("PM");em.persist(member);em.flush();memberId=member.getId();team.setLeaderMemberId(cm.getId());
            var project=new Project();project.setTenantId(tenantId);project.setClassId(classId);project.setTeamId(teamId);
            project.setCode("ALLOC-"+UUID.randomUUID());project.setName("Assigned project");project.setStatus(ProjectStatus.PLANNING);em.persist(project);em.flush();projectId=project.getId();team.setProject(project);
            var workspace=new Workspace();workspace.setTenant(tenant);workspace.setTeam(team);workspace.setProject(project);
            workspace.setCode("ALLOC-"+UUID.randomUUID());workspace.setName("Pre-created workspace");workspace.setStatus(WorkspaceStatus.ACTIVE);em.persist(workspace);em.flush();workspaceId=workspace.getId();
        });
    }
    String path() {return "/api/v1/classes/"+classId+"/allocation-sessions";}
    void assertStates(ProjectTeamStatus team,ProjectStatus project) {
        tx.executeWithoutResult(status->{
            assertThat(em.find(ProjectTeam.class,teamId).getStatus()).isEqualTo(team);
            assertThat(em.find(Project.class,projectId).getStatus()).isEqualTo(project);
            var workspace=em.find(Workspace.class,workspaceId);
            assertThat(workspace.getProject().getId()).isEqualTo(projectId);
            assertThat(workspace.getStatus()).isEqualTo(WorkspaceStatus.ACTIVE);
            assertThat(em.createQuery("select count(w) from Workspace w where w.team.id=:id",Long.class)
                    .setParameter("id",teamId).getSingleResult()).isEqualTo(1L);
        });
    }
    @Test void legacySessionWithoutTemplateDoesNotHideOtherSessionsOrTheirTeams() throws Exception {
        Long old=tx.execute(status->{
            var session=new TeamAllocationSession();session.setTrainingClass(em.find(TrainingClass.class,classId));
            session.setStatus(TeamAllocationSessionStatus.OPEN);session.setMaxMembers(5);em.persist(session);em.flush();return session.getId();
        });
        var result=mvc.perform(get(path()).header("Authorization","Bearer "+admin)).andExpect(status().isOk()).andReturn();
        JsonNode rows=json.readTree(result.getResponse().getContentAsString());
        assertThat(rows).hasSize(2);
        var legacy=rows.findParents("id").stream().filter(row->row.get("id").asLong()==old).findFirst().orElseThrow();
        assertThat(legacy.get("projectTemplateId").isNull()).isTrue();
        mvc.perform(get(path()+"/"+sessionId+"/teams").header("Authorization","Bearer "+admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.teams[0].teamId").value(teamId));
        mvc.perform(get(path()).header("Authorization","Bearer "+student)).andExpect(status().isForbidden());
        assertStates(ProjectTeamStatus.DRAFT,ProjectStatus.PLANNING);
    }
    @Test void publishingPreparedTeamActivatesItsProjectAndReusesTheExistingWorkspace() throws Exception {
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.statuses.PLANNING").value(1));
        mvc.perform(post(path()+"/"+sessionId+"/publish-session").header("Authorization","Bearer "+admin)
                .header("X-Idempotency-Key",UUID.randomUUID().toString())).andExpect(status().isOk())
                .andExpect(jsonPath("$.failedItems").isEmpty()).andExpect(jsonPath("$.succeededItems[0]").value(teamId));
        assertStates(ProjectTeamStatus.ACTIVE,ProjectStatus.ACTIVE);
        tx.executeWithoutResult(status->assertThat(em.find(TeamAllocationSession.class,sessionId).getStatus()).isEqualTo(TeamAllocationSessionStatus.PUBLISHED));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.statuses.ACTIVE").value(1))
                .andExpect(jsonPath("$.statuses.PLANNING").value(0));
    }
    @Test void failedPublishDoesNotActivateProjectBeforeReadinessValidation() throws Exception {
        tx.executeWithoutResult(status->em.find(ProjectTeam.class,teamId).setLeaderMemberId(null));
        mvc.perform(post(path()+"/"+sessionId+"/publish-session").header("Authorization","Bearer "+admin)
                .header("X-Idempotency-Key",UUID.randomUUID().toString())).andExpect(status().isUnprocessableEntity());
        assertStates(ProjectTeamStatus.DRAFT,ProjectStatus.PLANNING);
    }
    @Test void publishingAllowsAnActiveLeaderWhoseProjectRoleIsDev() throws Exception {
        tx.executeWithoutResult(status->em.find(ProjectMember.class,memberId).setRole("DEV"));
        mvc.perform(post(path()+"/"+sessionId+"/publish-session").header("Authorization","Bearer "+admin)
                .header("X-Idempotency-Key",UUID.randomUUID().toString())).andExpect(status().isOk())
                .andExpect(jsonPath("$.failedItems").isEmpty());
        assertStates(ProjectTeamStatus.ACTIVE,ProjectStatus.ACTIVE);
        tx.executeWithoutResult(status->assertThat(em.find(ProjectMember.class,memberId).getRole()).isEqualTo("DEV"));
    }
    @Test void publishingStillRejectsTeamsExceedingTheTemplateRoleMaximum() throws Exception {
        tx.executeWithoutResult(status->{
            em.find(ProjectMember.class,memberId).setRole("DEV");
            em.find(ProjectTemplate.class,templateId).setConstraintsJson("{\"min_members\":1,\"max_members\":5,\"role_quotas\":{\"DEV\":{\"min\":0,\"max\":1}}}");
            var learner=user(em.find(Tenant.class,tenantId),"STUDENT","Second learner");
            var cm=new ClassMember();cm.setTrainingClass(em.find(TrainingClass.class,classId));cm.setUser(learner);cm.setStatus(ClassMemberStatus.ACTIVE);em.persist(cm);
            var member=new ProjectMember();member.setTeam(em.find(ProjectTeam.class,teamId));member.setClassMember(cm);member.setRole("DEV");em.persist(member);
        });
        mvc.perform(post(path()+"/"+sessionId+"/publish-session").header("Authorization","Bearer "+admin)
                .header("X-Idempotency-Key",UUID.randomUUID().toString())).andExpect(status().isUnprocessableEntity());
        assertStates(ProjectTeamStatus.DRAFT,ProjectStatus.PLANNING);
    }
    @Test void restartBackfillDoesNotStartUnpublishedProjectsJustBecauseWorkspaceExists() {
        tx.executeWithoutResult(status->{projects.activateProjectsWithWorkspace();em.clear();});
        assertStates(ProjectTeamStatus.DRAFT,ProjectStatus.PLANNING);
    }
    @Test void restartBackfillRepairsPublishedTeamsButPreservesClosedProjects() {
        tx.executeWithoutResult(status->em.find(ProjectTeam.class,teamId).setStatus(ProjectTeamStatus.ACTIVE));
        tx.executeWithoutResult(status->{projects.activateProjectsWithWorkspace();em.clear();});
        assertStates(ProjectTeamStatus.ACTIVE,ProjectStatus.ACTIVE);
        for(var closed:List.of(ProjectStatus.COMPLETED,ProjectStatus.CANCELLED)) {
            tx.executeWithoutResult(status->em.find(Project.class,projectId).setStatus(closed));
            tx.executeWithoutResult(status->{projects.activateProjectsWithWorkspace();em.clear();});
            assertStates(ProjectTeamStatus.ACTIVE,closed);
        }
    }
    @Test void retryForAlreadyPublishedTeamRepairsPlanningProjectWithoutAnotherWorkspace() throws Exception {
        tx.executeWithoutResult(status->em.find(ProjectTeam.class,teamId).setStatus(ProjectTeamStatus.ACTIVE));
        mvc.perform(post(path()+"/"+sessionId+"/teams/publish").header("Authorization","Bearer "+admin)
                .header("X-Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"teamIds\":["+teamId+"]}")).andExpect(status().isOk()).andExpect(jsonPath("$.failedItems").isEmpty());
        assertStates(ProjectTeamStatus.ACTIVE,ProjectStatus.ACTIVE);
    }
}
