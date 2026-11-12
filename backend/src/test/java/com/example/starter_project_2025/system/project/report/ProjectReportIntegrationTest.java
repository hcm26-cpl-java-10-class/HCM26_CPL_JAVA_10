package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.init.SprintBacklogDataInitializer;
import com.example.starter_project_2025.init.AutoMenuInitializer;
import com.example.starter_project_2025.system.menu.module.Module;
import com.example.starter_project_2025.system.menu.module_groups.ModuleGroup;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.domain.*;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.project_template_version.*;
import com.example.starter_project_2025.system.project.sprint_backlog.*;
import com.example.starter_project_2025.system.project.tenant.*;
import com.example.starter_project_2025.system.project.trainingclass.*;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.rbac.permission.*;
import com.example.starter_project_2025.system.rbac.role.*;
import com.example.starter_project_2025.system.rbac.user.*;
import com.fasterxml.jackson.databind.*;
import jakarta.persistence.EntityManager;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"app.seed.board.enabled=false","app.seed.team-allocation.enabled=false",
        "app.task-alert.demo.enabled=false","app.member-reminder.demo.enabled=false","app.project-reports.export.worker-enabled=false",
        "milestone.mock.seed-enabled=false","milestone.submission.mock.seed-enabled=false"})
@AutoConfigureMockMvc @ActiveProfiles({"test","artifact-real-scope"})
class ProjectReportIntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired EntityManager em; @Autowired TransactionTemplate tx;
    @Autowired RoleRepository roles; @Autowired PermissionRepository permissions; @Autowired UserRepository users;
    @Autowired UserDetailsService details; @Autowired RefreshTokenService tokens;
    @Autowired ProjectReportExportService exports; @Autowired ProjectReportExportRepository jobs;
    @Autowired AutoMenuInitializer menus;
    @MockBean(name="projectReportClock") Clock clock;
    @MockBean SprintBacklogDataInitializer legacySeed;
    Instant now=Instant.parse("2026-10-30T12:00:00Z");
    Long tenantId,classId,templateId,sourceId,mentorId,otherMentorId,adminId,managerId,teamA,teamB,projectA,projectB;
    UUID milestoneA,milestoneB;String admin,mentor,manager,student;

    User user(Tenant tenant,Role role,String name) {
        var u=new User();u.setEmail(UUID.randomUUID()+"@reports.test");u.setFirstName(name);u.setLastName("Report");u.setPasswordHash("unused");
        u.setUserCode("R-"+UUID.randomUUID());u.setTenant(tenant);u.setRoles(new HashSet<>(Set.of(role)));em.persist(u);em.flush();return u;
    }
    String token(User user) {var principal=details.loadUserByUsername(user.getEmail());return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()));}
    Role role(String name) {
        var role=roles.findByName(name).orElseGet(()->{var r=new Role();r.setName(name);return roles.saveAndFlush(r);});
        role.getPermissions().add(permissions.findByName("PROJECT_REPORT_READ").orElseThrow());
        role.getPermissions().add(permissions.findByName("PROJECT_REPORT_EXPORT").orElseThrow());return roles.saveAndFlush(role);
    }
    ProjectTemplateSnapshot version(Long parent) {
        var s=new ProjectTemplateSnapshot();s.setTemplateId(templateId);s.setVersion("v"+UUID.randomUUID());s.setContentJson(parent==null?"{}":"{\"purpose\":\"TEAM_ASSIGNMENT\"}");
        s.setParentTemplateId(parent);s.setStatus(ProjectTemplateVersionStatus.PUBLISHED);em.persist(s);em.flush();return s;
    }
    TrainingClass school(Tenant tenant,Long program) {
        var c=new TrainingClass();c.setTenantId(tenant.getId());c.setCode("R-"+UUID.randomUUID());c.setName("Class "+program);
        c.setProgramId(program);c.setProgramName("Program "+program);c.setCohortId(program+100);c.setCohortName("Cohort "+program);
        c.setMentorId(mentorId);c.setStatus(TrainingClassStatus.ONGOING);em.persist(c);em.flush();return c;
    }
    ProjectTeam team(TrainingClass school,Long mentor,ProjectStatus state,Long source) {
        var p=new Project();p.setTenantId(school.getTenantId());p.setCode("R-"+UUID.randomUUID());p.setName("Booking project");p.setStatus(state);p.setClassId(school.getId());
        p.setTemplateSnapshotId(version(source).getId());em.persist(p);
        var session=new TeamAllocationSession();session.setTrainingClass(school);session.setMaxMembers(8);session.setStatus(TeamAllocationSessionStatus.PUBLISHED);session.setVersion(0L);em.persist(session);
        var team=new ProjectTeam();team.setTrainingClass(school);team.setAllocationSession(session);team.setTeamName("Team "+UUID.randomUUID());team.setMaxMembers(8);team.setVersion(0L);
        team.setProject(p);team.setProjectTemplate(em.find(ProjectTemplate.class,templateId));team.setProjectTemplateVersionId(source);team.setAssignedMentorId(mentor);team.setStatus(ProjectTeamStatus.ACTIVE);em.persist(team);em.flush();p.setTeamId(team.getId());return team;
    }
    Milestone milestone(ProjectTeam team,Instant due,boolean accepted) {
        var m=Milestone.create(team.getTrainingClass().getTenantId(),team.getProjectId(),team.getId(),"Delivery",null,due,true,UUID.randomUUID(),null,LatePolicyType.NO_LATE,null,null,UUID.randomUUID(),now);
        m.configureAssessment(new BigDecimal("100"),LatePenaltyBasis.FIXED);m.openForWork(UUID.randomUUID(),now);m.start(UUID.randomUUID(),now);
        if(accepted){m.setExecutionStatus(MilestoneExecutionStatus.REVIEW,UUID.randomUUID(),now);m.setExecutionStatus(MilestoneExecutionStatus.DONE,UUID.randomUUID(),now);}
        em.persist(m);em.flush();return m;
    }
    void task(ProjectTeam team,Milestone milestone,SprintBacklogStatus state) {
        var b=new SprintBacklog();b.setProjectId(team.getProjectId());b.setTitle("Work item");b.setStatus(state);b.setMilestone(milestone);em.persist(b);
    }
    @BeforeEach void setup() {
        when(clock.instant()).thenReturn(now);
        tx.executeWithoutResult(status->{
            var tenant=Tenant.builder().code("REPORT-"+UUID.randomUUID()).name("Reports tenant").build();em.persist(tenant);em.flush();tenantId=tenant.getId();
            var mentorUser=user(tenant,role("MENTOR"),"Mentor");mentorId=mentorUser.getId();mentor=token(mentorUser);
            otherMentorId=user(tenant,role("MENTOR"),"Other Mentor").getId();
            var adminUser=user(tenant,role("ADMIN"),"Admin");adminId=adminUser.getId();admin=token(adminUser);
            var pm=user(tenant,role("PROGRAM_MANAGER"),"Manager");managerId=pm.getId();manager=token(pm);
            student=token(user(tenant,roles.findByName("STUDENT").orElseThrow(),"Student"));
            var template=new ProjectTemplate();template.setTenantId(tenantId);template.setName("Booking template");em.persist(template);em.flush();templateId=template.getId();sourceId=version(null).getId();
            var c=school(tenant,801L);classId=c.getId();var a=team(c,mentorId,ProjectStatus.ACTIVE,sourceId);var b=team(c,otherMentorId,ProjectStatus.ACTIVE,sourceId);
            teamA=a.getId();teamB=b.getId();projectA=a.getProjectId();projectB=b.getProjectId();
            var ma=milestone(a,now.plusSeconds(86400),false);milestoneA=ma.getId();task(a,ma,SprintBacklogStatus.DONE);task(a,ma,SprintBacklogStatus.TODO);
            milestoneB=milestone(b,now.minusSeconds(7200),true).getId();
            // Same class mentor is insufficient to read a team assigned to another Mentor.
            team(school(tenant,802L),otherMentorId,ProjectStatus.ACTIVE,sourceId);
            var otherTenant=Tenant.builder().code("OTHER-"+UUID.randomUUID()).name("Foreign tenant").build();em.persist(otherTenant);em.flush();
            team(school(otherTenant,803L),mentorId,ProjectStatus.ACTIVE,sourceId);
        });
    }
    ResultActions report(String token) throws Exception {return mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+token).param("classId",classId.toString()));}
    JsonNode body(ResultActions result)throws Exception{return json.readTree(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));}
    UUID export(String format,UUID key) throws Exception {
        return UUID.fromString(body(mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+admin).header("Idempotency-Key",key.toString())
                .contentType(MediaType.APPLICATION_JSON).content("{\"format\":\""+format+"\",\"filters\":{\"classId\":"+classId+",\"size\":1}}"))
                .andExpect(status().isAccepted())).get("id").asText());
    }
    @Test void reportMenuMovesToProjectManagementWithoutDuplicatingTheExistingEntry() throws Exception {
        Long originalId = tx.execute(status -> {
            var menu = em.createQuery("select m from Module m where m.url=:url", Module.class)
                    .setParameter("url", "/management/reports/projects").getSingleResult();
            var oldGroup = new ModuleGroup();oldGroup.setName("Reports");em.persist(oldGroup);
            menu.setModuleGroup(oldGroup);return menu.getId();
        });
        menus.run();
        tx.executeWithoutResult(status -> {
            var menu = em.find(Module.class, originalId);
            assertThat(menu.getModuleGroup().getName()).isEqualTo("Project Management");
            assertThat(menu.getRequiredPermission()).isEqualTo("PROJECT_REPORT_READ");
            assertThat(em.createQuery("select count(m) from Module m where m.url=:url", Long.class)
                    .setParameter("url", "/management/reports/projects").getSingleResult()).isEqualTo(1L);
            assertThat(em.createQuery("select m.moduleGroup.name from Module m where m.url='/sprints'", String.class)
                    .getSingleResult()).isEqualTo("Project Management");
        });
    }
    @Test void independentRootsDoNotMergeEvenWhenClassAndTemplateAreTheSame() throws Exception {
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.summary.teams").value(2)).andExpect(jsonPath("$.summary.classes").value(1))
                .andExpect(jsonPath("$.summary.subProjects").value(0)).andExpect(jsonPath("$.statuses.ACTIVE").value(2))
                .andExpect(jsonPath("$.summary.backlog.total").value(2))
                .andExpect(jsonPath("$.summary.averageProgress").doesNotExist()).andExpect(jsonPath("$.summary.completionRate").doesNotExist());
        var masters=body(report(admin)).get("content");
        assertThat(masters).hasSize(2);assertThat(masters.get(0).get("projects")).isEmpty();
        assertThat(masters.get(0).get("id")).isNotEqualTo(masters.get(1).get("id"));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("status","ACTIVE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("masterStatus","ACTIVE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
    }
    @Test void mentorScopeIgnoresClassWideAssignmentAndForeignTenantAndOptionsUseSameScope() throws Exception {
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.summary.teams").value(1)).andExpect(jsonPath("$.summary.backlog.total").value(2));
        mvc.perform(get("/api/project-reports/options").header("Authorization","Bearer "+mentor)).andExpect(status().isOk()).andExpect(jsonPath("$.teams.length()").value(1));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+mentor).param("teamId",teamB.toString())).andExpect(status().isForbidden());
        report(student).andExpect(status().isForbidden());
    }
    @Test void managerRequiresProgramGrantAndCannotSeeOtherProgramsOrForeignTenant() throws Exception {
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+manager)).andExpect(jsonPath("$.summary.teams").value(0));
        tx.executeWithoutResult(status->{var s=new UserDataScope();s.setUser(em.find(User.class,managerId));s.setTenantId(tenantId);s.setScopeType(UserScopeType.PROGRAM);s.setTargetId(801L);em.persist(s);});
        report(manager).andExpect(status().isOk()).andExpect(jsonPath("$.summary.teams").value(2));
    }
    @Test void overdueFilterUsesCurrentRiskAndTaskChangesDoNotCompleteTheProject() throws Exception {
        tx.executeWithoutResult(status->em.find(Milestone.class,milestoneA).editActive("Late",now.minusSeconds(1),UUID.randomUUID(),now));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("risk","OVERDUE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].id").value(projectA)).andExpect(jsonPath("$.content[0].backlog.total").value(2))
                .andExpect(jsonPath("$.summary.overdueProjects").value(1)).andExpect(jsonPath("$.statuses.ACTIVE").value(1));
        tx.executeWithoutResult(status->em.createQuery("update SprintBacklog b set b.status=:done where b.projectId=:project")
                .setParameter("done",SprintBacklogStatus.DONE).setParameter("project",projectA).executeUpdate());
        report(admin).andExpect(jsonPath("$.summary.backlog.done").value(2)).andExpect(jsonPath("$.statuses.ACTIVE").value(2));
    }
    @Test void onTimeSubmittedIsNotOverdueAndAcceptedLateSubmissionDoesNotChangeProjectState() throws Exception {
        tx.executeWithoutResult(status->{var a=em.find(Milestone.class,milestoneA);a.editActive(null,now.minusSeconds(60),UUID.randomUUID(),now);a.setExecutionStatus(MilestoneExecutionStatus.REVIEW,UUID.randomUUID(),now);
            em.persist(MilestoneArtifactSubmission.submit(tenantId,projectA,teamA,milestoneA,UUID.randomUUID(),1,null,null,null,"[]","[]",now.minusSeconds(120),false,null));
            em.persist(MilestoneArtifactSubmission.submit(tenantId,projectB,teamB,milestoneB,UUID.randomUUID(),1,null,null,null,"[]","[]",now.minusSeconds(30),true,null));});
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.summary.overdueProjects").value(0))
                .andExpect(jsonPath("$.summary.lateProjects").value(1)).andExpect(jsonPath("$.statuses.ACTIVE").value(2))
                .andExpect(jsonPath("$.statuses.COMPLETED").value(0));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("risk","OVERDUE"))
                .andExpect(jsonPath("$.total").value(0));
    }
    @Test void plannedAndCancelledProjectsKeepTheirOwnStatesAndDraftTeamsRemainVisible() throws Exception {
        tx.executeWithoutResult(status->{var planned=team(em.find(TrainingClass.class,classId),mentorId,ProjectStatus.PLANNING,sourceId);planned.setStatus(ProjectTeamStatus.DRAFT);
            team(em.find(TrainingClass.class,classId),mentorId,ProjectStatus.CANCELLED,sourceId);});
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.summary.masters").value(4))
                .andExpect(jsonPath("$.statuses.PLANNING").value(1)).andExpect(jsonPath("$.statuses.CANCELLED").value(1))
                .andExpect(jsonPath("$.statuses.ACTIVE").value(2));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("includeCancelled","false"))
                .andExpect(jsonPath("$.total").value(3)).andExpect(jsonPath("$.statuses.CANCELLED").value(0));
    }
    @Test void erdMilestoneWithNoBacklogKeepsItsAcceptedStateWithoutInventedProgress() throws Exception {
        tx.executeWithoutResult(status->{var a=em.find(ProjectTeam.class,teamA);var m=milestone(a,null,true);m.configureAssessment(null,LatePenaltyBasis.FIXED);});
        var data=body(report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.summary.backlog.total").value(2))
                .andExpect(jsonPath("$.statuses.ACTIVE").value(2)));
        var a=data.get("content").findParents("key").stream().filter(row->row.get("id").asLong()==projectA).findFirst().orElseThrow();
        var noBacklog=a.get("project").get("milestones").get(1);
        assertThat(noBacklog.get("status").asText()).isEqualTo("ACCEPTED");assertThat(noBacklog.get("backlog").get("total").asLong()).isZero();
        assertThat(noBacklog.has("progress")).isFalse();
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("createdFrom","2026-11-01").param("createdTo","2026-10-01")).andExpect(status().isUnprocessableEntity());
    }
    @Test void backgroundExcelExportsAllPagesAndSameRequestIsIdempotent() throws Exception {
        tx.executeWithoutResult(status->team(em.find(TrainingClass.class,classId),mentorId,ProjectStatus.ACTIVE,version(null).getId()));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("size","1"))
                .andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.summary.masters").value(3)).andExpect(jsonPath("$.summary.teams").value(3))
                .andExpect(jsonPath("$.summary.classes").value(1));
        var key=UUID.randomUUID();var id=export("EXCEL",key);assertThat(export("EXCEL",key)).isEqualTo(id);exports.process(id);
        mvc.perform(get("/api/project-reports/exports/{id}",id).header("Authorization","Bearer "+admin)).andExpect(jsonPath("$.status").value("READY")).andExpect(jsonPath("$.rowCount").value(3));
        byte[] bytes=mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+admin)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try(var workbook=WorkbookFactory.create(new ByteArrayInputStream(bytes))){
            assertThat(workbook.getNumberOfSheets()).isEqualTo(6);
            var sheet=workbook.getSheet("Tiến độ dự án");
            assertThat(sheet.getLastRowNum()-ProjectReportExcelWriter.HEADER_ROW).isEqualTo(3);
            var header=sheet.getRow(ProjectReportExcelWriter.HEADER_ROW);
            assertThat(header.getLastCellNum()).isEqualTo((short)7);
            assertThat(java.util.stream.StreamSupport.stream(header.spliterator(),false).map(org.apache.poi.ss.usermodel.Cell::getStringCellValue).toList())
                    .containsExactly("Lớp","Nhóm phụ trách","Master Project","Sub-project","Trạng thái","Mentor","Tiến độ milestone");
            assertThat(sheet.getPaneInformation().isFreezePane()).isTrue();
            assertThat(sheet.getColumnWidth(2)).isGreaterThan(30*256);
        }
        mvc.perform(get("/api/project-reports/exports").header("Authorization","Bearer "+admin)).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id.toString()));
        mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+mentor)).andExpect(status().isNotFound());
        Long downloads=tx.execute(status->em.createQuery("select count(a) from ProjectReportExportAudit a where a.jobId=:id and a.action='DOWNLOADED'",Long.class).setParameter("id",id).getSingleResult());
        assertThat(downloads).isEqualTo(1);
    }
    @Test void excelKeepsFormulaLikeNamesAsTextAndDownloadExpiresAndClearsStoredFile() throws Exception {
        tx.executeWithoutResult(status->em.find(Project.class,projectA).setName("=1+1, \"Tên Việt\"\nDòng hai"));
        var id=export("EXCEL",UUID.randomUUID());exports.process(id);
        byte[] bytes=mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+admin))
                .andExpect(status().isOk()).andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andReturn().getResponse().getContentAsByteArray();
        try(var workbook=WorkbookFactory.create(new ByteArrayInputStream(bytes))){
            boolean found=false;
            for(var row:workbook.getSheetAt(0))for(var cell:row){
                assertThat(cell.getCellType()).isNotEqualTo(org.apache.poi.ss.usermodel.CellType.FORMULA);
                if(cell.getCellType()==org.apache.poi.ss.usermodel.CellType.STRING&&cell.getStringCellValue().contains("=1+1, \"Tên Việt\"\nDòng hai"))found=true;
            }
            assertThat(found).isTrue();
        }
        when(clock.instant()).thenReturn(now.plus(Duration.ofHours(25)));
        mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+admin)).andExpect(status().isGone());
        var job=jobs.findById(id).orElseThrow();assertThat(job.getFileContent()).isNull();assertThat(job.getStatus()).isEqualTo(ProjectReportExportJob.State.EXPIRED);
    }
    @Test void csvIsRejectedAndLegacyCsvDoesNotAppearOrBlockExcelExports() throws Exception {
        mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+admin)
                .header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"format\":\"CSV\"}")).andExpect(status().isUnprocessableEntity());
        var legacy=export("EXCEL",UUID.randomUUID());
        // Emulate a CSV job stored by an older release, without deleting historical data.
        tx.executeWithoutResult(status->{em.createNativeQuery("update project_report_exports set format='CSV' where id=:id")
                .setParameter("id",legacy).executeUpdate();em.clear();});
        var excel=export("EXCEL",UUID.randomUUID());
        mvc.perform(get("/api/project-reports/exports").header("Authorization","Bearer "+admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(excel.toString())).andExpect(jsonPath("$[0].format").value("EXCEL"));
        assertThat(jobs.pending(ProjectReportExportJob.State.QUEUED,org.springframework.data.domain.PageRequest.of(0,20)))
                .contains(excel).doesNotContain(legacy);
        exports.process(legacy);
        assertThat(jobs.findById(legacy).orElseThrow().getStatus()).isEqualTo(ProjectReportExportJob.State.QUEUED);
        mvc.perform(get("/api/project-reports/exports/{id}",legacy).header("Authorization","Bearer "+admin)).andExpect(status().isNotFound());
        mvc.perform(get("/api/project-reports/exports/{id}/download",legacy).header("Authorization","Bearer "+admin)).andExpect(status().isNotFound());
    }
    @Test void exportDownloadRechecksProjectScopeAndPermissionRevocation() throws Exception {
        tx.executeWithoutResult(status->em.find(Milestone.class,milestoneA).editActive(null,now.minusSeconds(1),UUID.randomUUID(),now));
        var result=mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+mentor).header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"format\":\"EXCEL\",\"filters\":{\"risk\":\"OVERDUE\"}}"));
        var id=UUID.fromString(body(result.andExpect(status().isAccepted())).get("id").asText());exports.process(id);
        tx.executeWithoutResult(status->em.find(ProjectTeam.class,teamA).setAssignedMentorId(otherMentorId));
        mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+mentor)).andExpect(status().isForbidden());
        var ownRoleId=tx.execute(status->{var r=new Role();r.setName("REPORT-"+UUID.randomUUID());r.getPermissions().add(permissions.findByName("PROJECT_REPORT_READ").orElseThrow());em.persist(r);em.flush();return r.getId();});
        tx.executeWithoutResult(status->em.find(User.class,adminId).setRoles(new HashSet<>(Set.of(em.find(Role.class,ownRoleId)))));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin)).andExpect(status().isOk()).andExpect(jsonPath("$.summary.teams").value(0));
        mvc.perform(get("/api/project-reports/exports").header("Authorization","Bearer "+admin)).andExpect(status().isForbidden());
    }
    @Test void backlogRollupAvoidsMultiplyingItemsWhenThereAreSeveralSubmissions() throws Exception {
        tx.executeWithoutResult(status->{var team=em.find(ProjectTeam.class,teamA);milestone(team,null,true);
            var author=UUID.randomUUID();
            for(long version=1;version<=2;version++)em.persist(MilestoneArtifactSubmission.submit(tenantId,projectA,teamA,milestoneA,author,version,null,null,null,"[]","[]",now.minusSeconds(version),false,null));
        });
        var data=body(report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.summary.backlog.total").value(2))
                .andExpect(jsonPath("$.summary.backlog.todo").value(1)).andExpect(jsonPath("$.summary.backlog.done").value(1)));
        var a=data.get("content").findParents("key").stream().filter(row->row.get("id").asLong()==projectA).findFirst().orElseThrow();
        var first=a.get("project").get("milestones").get(0);
        assertThat(first.get("backlog").get("total").asLong()).isEqualTo(2);
    }
    @Test void downloadRechecksHierarchyScopeForFilteredExcel() throws Exception {
        splitHierarchy();
        tx.executeWithoutResult(status->{var s=new UserDataScope();s.setUser(em.find(User.class,managerId));s.setTenantId(tenantId);s.setScopeType(UserScopeType.PROGRAM);s.setTargetId(801L);em.persist(s);
            em.find(Milestone.class,milestoneA).editActive(null,now.minusSeconds(1),UUID.randomUUID(),now);});
        var result=mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+manager).header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"format\":\"EXCEL\",\"filters\":{\"risk\":\"OVERDUE\"}}"));
        var id=UUID.fromString(body(result.andExpect(status().isAccepted())).get("id").asText());exports.process(id);
        assertThat(jobs.findById(id).orElseThrow().getRowCount()).isEqualTo(1);
        tx.executeWithoutResult(status->em.find(ProjectTeam.class,teamB).setTrainingClass(school(em.find(Tenant.class,tenantId),802L)));
        mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+manager)).andExpect(status().isForbidden());
    }
    @Test void exportRejectsReusedKeyWithChangedPayloadAndMalformedFilters() throws Exception {
        var key=UUID.randomUUID();export("EXCEL",key);
        mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+admin).header("Idempotency-Key",key.toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"format\":\"EXCEL\",\"filters\":{\"classId\":"+classId+",\"q\":\"changed\"}}" )).andExpect(status().isConflict());
        mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+admin).header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"format\":\"PDF\"}" )).andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("status","UNKNOWN")).andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("size","0")).andExpect(status().isUnprocessableEntity());
    }
    @Test void reportReadsNeverCompleteBusinessProjectOrCreateAlertHistory() throws Exception {
        Long before=tx.execute(status->em.createQuery("select count(b) from ProjectAlertBatch b",Long.class).getSingleResult());
        report(admin).andExpect(status().isOk());
        tx.executeWithoutResult(status->{assertThat(em.find(Project.class,projectB).getStatus()).isEqualTo(ProjectStatus.ACTIVE);
            assertThat(em.createQuery("select count(b) from ProjectAlertBatch b",Long.class).getSingleResult()).isEqualTo(before);});
    }
    @Test void invalidSnapshotReferenceDoesNotExposeAnotherTenantsVersionMetadata() throws Exception {
        tx.executeWithoutResult(status->{
            var foreign=Tenant.builder().code("SECRET-"+UUID.randomUUID()).name("Other tenant").build();em.persist(foreign);em.flush();
            var template=new ProjectTemplate();template.setTenantId(foreign.getId());template.setName("Secret template");em.persist(template);em.flush();
            var snapshot=new ProjectTemplateSnapshot();snapshot.setTemplateId(template.getId());snapshot.setVersion("Secret version");snapshot.setContentJson("{}");em.persist(snapshot);em.flush();
            var team=em.find(ProjectTeam.class,teamA);team.setProjectTemplate(null);team.setProjectTemplateVersionId(snapshot.getId());team.getProject().setTemplateSnapshotId(snapshot.getId());
        });
        String response=report(admin).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(response).doesNotContain("Secret template","Secret version");
    }
    Long workspace(ProjectTeam team) {
        var workspace=new Workspace();workspace.setTenant(em.find(Tenant.class,tenantId));workspace.setTeam(team);
        workspace.setProject(team.getProject());workspace.setCode("REPORT-"+UUID.randomUUID());workspace.setName("Prepared workspace");
        workspace.setStatus(WorkspaceStatus.ACTIVE);em.persist(workspace);em.flush();return workspace.getId();
    }
    @Test void planningProjectIsReportedButItsWorkspaceIsOnlyLinkedAfterTeamPublication() throws Exception {
        Long workspaceId=tx.execute(status->{
            var team=em.find(ProjectTeam.class,teamA);team.setStatus(ProjectTeamStatus.DRAFT);
            team.getAllocationSession().setStatus(TeamAllocationSessionStatus.OPEN);
            team.getProject().setStatus(ProjectStatus.PLANNING);return workspace(team);
        });
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("projectId",projectA.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.statuses.PLANNING").value(1))
                .andExpect(jsonPath("$.content[0].project.workspaceId").isEmpty());
        tx.executeWithoutResult(status->{
            var team=em.find(ProjectTeam.class,teamA);team.setStatus(ProjectTeamStatus.ACTIVE);team.getProject().setStatus(ProjectStatus.ACTIVE);
        });
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("projectId",projectA.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].project.workspaceId").value(workspaceId));
    }
    @Test void cancelledAllocationIsExcludedWithoutChangingItsProjectOrWorkspaceAndOldExportsLoseAccess() throws Exception {
        Long[] prepared=tx.execute(status->{
            var team=em.find(ProjectTeam.class,teamA);team.setStatus(ProjectTeamStatus.DRAFT);team.getProject().setStatus(ProjectStatus.PLANNING);
            team.getAllocationSession().setStatus(TeamAllocationSessionStatus.OPEN);
            return new Long[]{workspace(team),team.getAllocationSession().getId()};
        });
        var file=export("EXCEL",UUID.randomUUID());exports.process(file);
        assertThat(jobs.findById(file).orElseThrow().getStatus()).isEqualTo(ProjectReportExportJob.State.READY);
        mvc.perform(post("/api/v1/classes/{classId}/allocation-sessions/{sessionId}/cancel",classId,prepared[1])
                .header("Authorization","Bearer "+admin)).andExpect(status().isOk());
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.summary.masters").value(1))
                .andExpect(jsonPath("$.statuses.PLANNING").value(0)).andExpect(jsonPath("$.content[0].id").value(projectB));
        tx.executeWithoutResult(status->{
            assertThat(em.find(Project.class,projectA).getStatus()).isEqualTo(ProjectStatus.PLANNING);
            assertThat(em.find(Workspace.class,prepared[0]).getStatus()).isEqualTo(WorkspaceStatus.ACTIVE);
            assertThat(em.find(ProjectTeam.class,teamA).getStatus()).isEqualTo(ProjectTeamStatus.ARCHIVED);
        });
        mvc.perform(get("/api/project-reports/exports/{id}/download",file).header("Authorization","Bearer "+admin))
                .andExpect(status().isForbidden());
    }
    Project module(Project parent,ProjectTeam owner,String code,ProjectStatus state) {
        var project=new Project();project.setTenantId(tenantId);project.setClassId(classId);project.setCode(code+"-"+UUID.randomUUID());
        project.setName(code);project.setStatus(state);project.setParentProject(parent);project.setAssignmentId(9001L);project.setTeamId(owner.getId());
        em.persist(project);em.flush();
        var assignment=new com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignment();
        assignment.setProject(project);assignment.setTeam(owner);em.persist(assignment);
        return project;
    }
    void work(Project project,SprintBacklogStatus state) {
        var item=new SprintBacklog();item.setProjectId(project.getId());item.setStatus(state);item.setTitle("Direct work");em.persist(item);
    }
    Long splitHierarchy() {
        return tx.execute(status->{
            var root=new Project();root.setTenantId(tenantId);root.setClassId(classId);root.setCode("EC-"+UUID.randomUUID());root.setName("Split commerce");
            root.setStatus(ProjectStatus.ACTIVE);root.setAssignmentId(9001L);root.setTemplateSnapshotId(version(sourceId).getId());em.persist(root);em.flush();
            var a=em.find(Project.class,projectA);a.setParentProject(root);a.setAssignmentId(9001L);a.setName("Auth");
            var b=em.find(Project.class,projectB);b.setParentProject(root);b.setAssignmentId(9001L);b.setName("Payment");
            work(root,SprintBacklogStatus.REVIEW);work(b,SprintBacklogStatus.IN_PROGRESS);return root.getId();
        });
    }
    Long unpublishedSplitHierarchy() {
        Long rootId=splitHierarchy();
        tx.executeWithoutResult(status->{
            var root=em.find(Project.class,rootId);
            var school=em.find(TrainingClass.class,classId);
            var session=em.find(ProjectTeam.class,teamA).getAllocationSession();
            session.setStatus(TeamAllocationSessionStatus.OPEN);
            List<ProjectTeam> pending=new ArrayList<>(List.of(em.find(ProjectTeam.class,teamA),em.find(ProjectTeam.class,teamB)));
            for(int index=0;index<5;index++) pending.add(team(school,otherMentorId,ProjectStatus.PLANNING,sourceId));
            for(var team:pending) {
                team.setAllocationSession(session);team.setStatus(ProjectTeamStatus.DRAFT);
                team.getProject().setParentProject(root);team.getProject().setAssignmentId(9001L);
                team.getProject().setStatus(ProjectStatus.PLANNING);
            }
        });
        return rootId;
    }
    @Test void unpublishedSplitMasterIsPlanningAcrossDashboardFiltersAndExcelWithoutChangingBusinessData() throws Exception {
        Long root=unpublishedSplitHierarchy();
        var data=body(report(admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.masters").value(1)).andExpect(jsonPath("$.summary.runningMasters").value(0))
                .andExpect(jsonPath("$.summary.teams").value(7)).andExpect(jsonPath("$.summary.subProjects").value(7))
                .andExpect(jsonPath("$.statuses.PLANNING").value(1)).andExpect(jsonPath("$.statuses.ACTIVE").value(0))
                .andExpect(jsonPath("$.content[0].status").value("PLANNING"))
                .andExpect(jsonPath("$.content[0].project.status").value("PLANNING")));
        for(var project:data.path("content").get(0).path("projects")) {
            assertThat(project.path("status").asText()).isEqualTo("PLANNING");
            assertThat(project.path("masterStatus").asText()).isEqualTo("PLANNING");
            assertThat(project.path("workspaceId").isNull()).isTrue();
        }
        report(admin).andExpect(jsonPath("$.content[0].projects.length()").value(7));
        for(String filter:List.of("masterStatus","status")) {
            mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin)
                    .param("classId",classId.toString()).param(filter,"PLANNING"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                    .andExpect(jsonPath("$.statuses.PLANNING").value(1));
        }
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin)
                .param("classId",classId.toString()).param("masterStatus","ACTIVE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        var file=export("EXCEL",UUID.randomUUID());exports.process(file);
        byte[] bytes=mvc.perform(get("/api/project-reports/exports/{id}/download",file).header("Authorization","Bearer "+admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try(var workbook=WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            var sheet=workbook.getSheetAt(0);
            assertThat(sheet.getLastRowNum()-ProjectReportExcelWriter.HEADER_ROW).isEqualTo(8);
            for(int index=ProjectReportExcelWriter.HEADER_ROW+1;index<=sheet.getLastRowNum();index++)
                assertThat(sheet.getRow(index).getCell(4).getStringCellValue()).isEqualTo("Lên kế hoạch");
        }
        tx.executeWithoutResult(status->{
            assertThat(em.find(Project.class,root).getStatus()).isEqualTo(ProjectStatus.ACTIVE);
            assertThat(em.find(Project.class,projectA).getStatus()).isEqualTo(ProjectStatus.PLANNING);
            assertThat(em.find(ProjectTeam.class,teamA).getStatus()).isEqualTo(ProjectTeamStatus.DRAFT);
        });
    }
    @Test void publishedSplitTeamActivatesMasterReportEvenWhenFilteredOrHiddenFromAnotherMentor() throws Exception {
        unpublishedSplitHierarchy();
        tx.executeWithoutResult(status->{
            em.find(ProjectTeam.class,teamB).setStatus(ProjectTeamStatus.ACTIVE);
            em.find(Project.class,projectB).setStatus(ProjectStatus.ACTIVE);
        });
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.statuses.ACTIVE").value(1))
                .andExpect(jsonPath("$.summary.runningMasters").value(1));
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.content[0].projects.length()").value(1))
                .andExpect(jsonPath("$.content[0].projects[0].id").value(projectA))
                .andExpect(jsonPath("$.content[0].projects[0].status").value("PLANNING"));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("teamId",teamA.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.content[0].projects.length()").value(1));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+mentor).param("projectId",projectB.toString()))
                .andExpect(status().isForbidden());
        tx.executeWithoutResult(status->{
            for(var team:em.createQuery("select t from ProjectTeam t where t.trainingClass.id=:school",ProjectTeam.class)
                    .setParameter("school",classId).getResultList()) {
                team.setStatus(ProjectTeamStatus.ACTIVE);team.getProject().setStatus(ProjectStatus.ACTIVE);
            }
        });
        var published=body(report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.statuses.ACTIVE").value(1))
                .andExpect(jsonPath("$.summary.subProjects").value(7)));
        for(var project:published.path("content").get(0).path("projects"))
            assertThat(project.path("status").asText()).isEqualTo("ACTIVE");
    }
    @Test void unpublishedTeamsNeverOverrideExplicitCompletedOrCancelledMasterStates() throws Exception {
        Long root=unpublishedSplitHierarchy();
        for(var state:List.of(ProjectStatus.COMPLETED,ProjectStatus.CANCELLED)) {
            tx.executeWithoutResult(status->em.find(Project.class,root).setStatus(state));
            report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].status").value(state.name()))
                    .andExpect(jsonPath("$.statuses."+state.name()).value(1)).andExpect(jsonPath("$.statuses.PLANNING").value(0));
        }
    }
    @Test void wholeAssignmentHasOneMasterThreeModulesAndOneTeamWithDirectAndChildBacklog() throws Exception {
        tx.executeWithoutResult(status->{
            var team=em.find(ProjectTeam.class,teamA);var root=team.getProject();root.setName("Whole commerce");root.setAssignmentId(9001L);
            work(module(root,team,"MOD-AUTH",ProjectStatus.PLANNING),SprintBacklogStatus.IN_PROGRESS);
            var catalog=module(root,team,"MOD-CATALOG",ProjectStatus.ACTIVE);catalog.setTeamId(null);
            work(catalog,SprintBacklogStatus.REVIEW); // Mapping-only ownership is still part of WHOLE.
            work(module(root,team,"MOD-PAYMENT",ProjectStatus.COMPLETED),SprintBacklogStatus.TODO);
        });
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("q","Whole commerce"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.summary.teams").value(1))
                .andExpect(jsonPath("$.summary.subProjects").value(3)).andExpect(jsonPath("$.statuses.ACTIVE").value(1))
                .andExpect(jsonPath("$.statuses.COMPLETED").value(0)).andExpect(jsonPath("$.summary.backlog.total").value(5))
                .andExpect(jsonPath("$.summary.backlog.todo").value(2)).andExpect(jsonPath("$.summary.backlog.inProgress").value(1))
                .andExpect(jsonPath("$.summary.backlog.review").value(1)).andExpect(jsonPath("$.summary.backlog.done").value(1))
                .andExpect(jsonPath("$.content[0].project.backlog.total").value(2)).andExpect(jsonPath("$.content[0].projects.length()").value(3));
    }
    @Test void splitRollupPreservesMasterStateAndIncludesOnlyAuthorizedModulesBeforeAggregation() throws Exception {
        var root=splitHierarchy();
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].id").value(root)).andExpect(jsonPath("$.content[0].projects.length()").value(2))
                .andExpect(jsonPath("$.content[0].scopedTeams").value(2)).andExpect(jsonPath("$.content[0].backlog.total").value(4));
        var data=body(report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.summary.teams").value(1)).andExpect(jsonPath("$.content[0].projects.length()").value(1))
                .andExpect(jsonPath("$.content[0].backlog.total").value(3)).andExpect(jsonPath("$.content[0].project.teamId").isEmpty()));
        assertThat(data.get("content").get(0).get("projects").get(0).get("id").asLong()).isEqualTo(projectA);
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+mentor).param("projectId",projectB.toString())).andExpect(status().isForbidden());
    }
    @Test void childOverdueFilterReturnsParentAndMatchingChildWhileKeepingFullVisibleMasterBacklog() throws Exception {
        splitHierarchy();
        tx.executeWithoutResult(status->em.find(Milestone.class,milestoneA).editActive(null,now.minusSeconds(1),UUID.randomUUID(),now));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("risk","OVERDUE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.content[0].projects.length()").value(1))
                .andExpect(jsonPath("$.content[0].projects[0].id").value(projectA)).andExpect(jsonPath("$.content[0].backlog.total").value(4))
                .andExpect(jsonPath("$.content[0].status").value("ACTIVE")).andExpect(jsonPath("$.summary.subProjects").value(1));
    }
    @Test void moduleStatusFilterAndMasterStatusFilterUseSeparateProjectStates() throws Exception {
        splitHierarchy();
        tx.executeWithoutResult(status->em.find(Project.class,projectB).setStatus(ProjectStatus.COMPLETED));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("status","COMPLETED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].projects.length()").value(1))
                .andExpect(jsonPath("$.content[0].projects[0].id").value(projectB)).andExpect(jsonPath("$.statuses.ACTIVE").value(1))
                .andExpect(jsonPath("$.statuses.COMPLETED").value(0));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("masterStatus","COMPLETED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
    }
    @Test void deeperDescendantsAreIncludedOnceAndUnreadableAncestorWorkIsExcluded() throws Exception {
        tx.executeWithoutResult(status->{
            var root=em.find(Project.class,projectB);var a=em.find(Project.class,projectA);a.setParentProject(root);
            var team=em.find(ProjectTeam.class,teamA);var nested=module(a,team,"Nested module",ProjectStatus.ACTIVE);work(nested,SprintBacklogStatus.REVIEW);
            work(root,SprintBacklogStatus.DONE);
        });
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].id").value(projectB)).andExpect(jsonPath("$.content[0].project.contextOnly").value(true))
                .andExpect(jsonPath("$.content[0].backlog.total").value(3)).andExpect(jsonPath("$.content[0].projects.length()").value(2))
                .andExpect(jsonPath("$.content[0].projects[1].depth").value(2));
    }
    @Test void hierarchyExcelPreservesProjectSheetAndAddsScopedReportingSheetsWithoutPercentages() throws Exception {
        splitHierarchy();var id=export("EXCEL",UUID.randomUUID());exports.process(id);
        byte[] bytes=mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try(var workbook=WorkbookFactory.create(new ByteArrayInputStream(bytes))){
            assertThat(workbook.getNumberOfSheets()).isEqualTo(6);
            var sheet=workbook.getSheet("Tiến độ dự án");assertThat(sheet.getLastRowNum()-ProjectReportExcelWriter.HEADER_ROW).isEqualTo(3);
            StringBuilder text=new StringBuilder();sheet.forEach(row->row.forEach(cell->text.append(cell.toString()).append("|")));
            assertThat(text.toString()).contains("Split commerce","Auth","Payment","Phần việc trực tiếp Master","Đang triển khai","0/1 được chấp nhận","1/1 được chấp nhận","Chưa có milestone")
                    .doesNotContain("Progress (%)","Master progress","Tổng backlog");
        }
    }
    @Test void filteredExcelContainsOnlyPermittedModuleAndKeepsErdMilestoneWithNoBacklog() throws Exception {
        splitHierarchy();
        tx.executeWithoutResult(status->milestone(em.find(ProjectTeam.class,teamA),null,true));
        var created=mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+mentor)
                .header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"format\":\"EXCEL\",\"filters\":{\"teamId\":"+teamA+"}}"));
        var id=UUID.fromString(body(created.andExpect(status().isAccepted())).get("id").asText());exports.process(id);
        byte[] bytes=mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+mentor))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try(var workbook=WorkbookFactory.create(new ByteArrayInputStream(bytes))){
            assertThat(workbook.getNumberOfSheets()).isEqualTo(6);
            var assignments=workbook.getSheet("Tiến độ dự án");
            assertThat(assignments.getLastRowNum()-ProjectReportExcelWriter.HEADER_ROW).isEqualTo(1);
            assertThat(assignments.getRow(ProjectReportExcelWriter.HEADER_ROW+1).getCell(3).getStringCellValue()).contains("Auth");
            assertThat(assignments.getRow(ProjectReportExcelWriter.HEADER_ROW+1).getCell(6).getStringCellValue()).isEqualTo("1/2 được chấp nhận");
            StringBuilder text=new StringBuilder();assignments.forEach(row->row.forEach(cell->text.append(cell.toString()).append("|")));
            assertThat(text.toString()).doesNotContain("Payment");
        }
    }
    @Test void unassignedDirectBacklogWithTeamMembersDoesNotBreakDashboardOrCreateInactivity() throws Exception {
        tx.executeWithoutResult(status->{
            var team=em.find(ProjectTeam.class,teamA);
            var learner=user(em.find(Tenant.class,tenantId),roles.findByName("STUDENT").orElseThrow(),"Learner");
            var cm=new ClassMember();cm.setTrainingClass(team.getTrainingClass());cm.setUser(learner);cm.setStatus(ClassMemberStatus.ACTIVE);em.persist(cm);
            var member=new ProjectMember();member.setTeam(team);member.setClassMember(cm);member.setRole("MEMBER");em.persist(member);
            work(team.getProject(),SprintBacklogStatus.TODO);
            work(module(team.getProject(),team,"Unassigned module",ProjectStatus.ACTIVE),SprintBacklogStatus.REVIEW);
        });
        mvc.perform(get("/api/project-reports/options").header("Authorization","Bearer "+mentor)).andExpect(status().isOk());
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.summary.backlog.total").value(4))
                .andExpect(jsonPath("$.summary.backlog.todo").value(2)).andExpect(jsonPath("$.summary.backlog.review").value(1))
                .andExpect(jsonPath("$.summary.inactiveMembers").value(0));
    }
    @Test void inactivityIsScopedToAssignedModuleAndReadsDoNotChangeTeamsOrSendAlerts() throws Exception {
        Long[] ids=tx.execute(status->{
            var team=em.find(ProjectTeam.class,teamA);var project=module(team.getProject(),team,"Quiet module",ProjectStatus.ACTIVE);
            var user=user(em.find(Tenant.class,tenantId),roles.findByName("STUDENT").orElseThrow(),"Quiet student");
            var cm=new ClassMember();cm.setTrainingClass(team.getTrainingClass());cm.setUser(user);cm.setStatus(ClassMemberStatus.ACTIVE);em.persist(cm);
            var member=new ProjectMember();member.setTeam(team);member.setClassMember(cm);member.setRole("MEMBER");em.persist(member);em.flush();
            var item=new SprintBacklog();item.setProjectId(project.getId());item.setTitle("Waiting work");item.setStatus(SprintBacklogStatus.TODO);item.setAssigneeProjectMemberId(member.getId());em.persist(item);em.flush();
            var at=java.sql.Timestamp.valueOf(LocalDateTime.ofInstant(now.minus(Duration.ofDays(10)),ZoneId.systemDefault()));
            em.createNativeQuery("update project_members set created_at=:at where id=:id").setParameter("at",at).setParameter("id",member.getId()).executeUpdate();
            em.createNativeQuery("update sprint_backlog set created_at=:at where sprint_backlog_id=:id").setParameter("at",at).setParameter("id",item.getId()).executeUpdate();
            work(project,SprintBacklogStatus.TODO);
            return new Long[]{project.getId(),user.getId()};
        });
        Long before=tx.execute(status->em.createQuery("select count(b) from ProjectAlertBatch b",Long.class).getSingleResult());
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+mentor).param("risk","INACTIVE_MEMBERS"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.inactiveMembers").value(1))
                .andExpect(jsonPath("$.content[0].projects[0].id").value(ids[0]))
                .andExpect(jsonPath("$.content[0].projects[0].backlog.total").value(2))
                .andExpect(jsonPath("$.content[0].projects[0].inactiveMembers[0].userId").value(ids[1]));
        tx.executeWithoutResult(status->{
            assertThat(em.find(ProjectTeam.class,teamA).getProjectId()).isEqualTo(projectA);
            assertThat(em.createQuery("select count(b) from ProjectAlertBatch b",Long.class).getSingleResult()).isEqualTo(before);
        });
    }

    MilestoneSubmission kpiSubmission(Milestone stage, SubmissionStatus state) {
        var row=MilestoneSubmission.create(stage,stage.getTeamId(),"KPI team",UUID.randomUUID(),"Student",UUID.randomUUID(),"Reviewer",now);
        em.persist(row);
        var version=SubmissionVersion.draft(row,1,"Delivery","Notes","https://example.test",UUID.randomUUID(),now);
        em.persist(version);
        if(state!=SubmissionStatus.DRAFT) {
            version.submit(now,false,BigDecimal.ZERO);row.submitted(1,now);
            ReviewDecision decision=switch(state) {case ACCEPTED->ReviewDecision.ACCEPT;case REJECTED->ReviewDecision.REJECT;
                case CHANGES_REQUESTED->ReviewDecision.REQUEST_CHANGES;default->null;};
            if(decision!=null){version.applyDecision(decision);row.reviewed(decision,now);}
        }
        em.flush();return row;
    }

    @Test void kpiStatesUseLatestVersionBeforePaginationAndNeverIncludeAnotherMentorsTeam() throws Exception {
        tx.executeWithoutResult(status->{
            workspace(em.find(ProjectTeam.class,teamA));workspace(em.find(ProjectTeam.class,teamB));
            var a=kpiSubmission(em.find(Milestone.class,milestoneA),SubmissionStatus.CHANGES_REQUESTED);
            int next=a.openNextDraft(now);
            em.persist(SubmissionVersion.draft(a,next,"Updated delivery","Notes",null,UUID.randomUUID(),now));
            kpiSubmission(em.find(Milestone.class,milestoneB),SubmissionStatus.ACCEPTED);
        });
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("size","1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.overview.activeMasters").value(2)).andExpect(jsonPath("$.overview.activeTeams").value(2))
                .andExpect(jsonPath("$.overview.artifactStatuses.DRAFT").value(1))
                .andExpect(jsonPath("$.overview.artifactStatuses.ACCEPTED").value(1))
                .andExpect(jsonPath("$.overview.artifactStatuses.CHANGES_REQUESTED").value(0));
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.overview.activeMasters").value(1))
                .andExpect(jsonPath("$.overview.artifactStatuses.DRAFT").value(1))
                .andExpect(jsonPath("$.overview.artifactStatuses.ACCEPTED").value(0));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("teamId",teamB.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.overview.artifactStatuses.DRAFT").value(0))
                .andExpect(jsonPath("$.overview.artifactStatuses.ACCEPTED").value(1));
    }

    @Test void kpiReviewStatesStaySeparateAndLegacyCopiesAreNotCountedTwice() throws Exception {
        tx.executeWithoutResult(status->{
            var team=em.find(ProjectTeam.class,teamA);workspace(team);
            kpiSubmission(em.find(Milestone.class,milestoneA),SubmissionStatus.CHANGES_REQUESTED);
            kpiSubmission(milestone(team,now.plusSeconds(10000),false),SubmissionStatus.REJECTED);
            var pending=milestone(team,now.plusSeconds(10000),false);
            kpiSubmission(pending,SubmissionStatus.SUBMITTED);
            for(int version=1;version<=3;version++)em.persist(MilestoneArtifactSubmission.submit(tenantId,projectA,teamA,pending.getId(),
                    UUID.randomUUID(),version,"https://example.test",null,null,"{}","[]",now,false,BigDecimal.ZERO));
        });
        report(mentor).andExpect(status().isOk())
                .andExpect(jsonPath("$.overview.milestoneStatuses.CHANGES_REQUESTED").value(1))
                .andExpect(jsonPath("$.overview.milestoneStatuses.REJECTED").value(1))
                .andExpect(jsonPath("$.overview.milestoneStatuses.SUBMITTED").value(1))
                .andExpect(jsonPath("$.overview.artifactStatuses.CHANGES_REQUESTED").value(1))
                .andExpect(jsonPath("$.overview.artifactStatuses.REJECTED").value(1))
                .andExpect(jsonPath("$.overview.artifactStatuses.SUBMITTED").value(1))
                .andExpect(jsonPath("$.overview.milestoneRisks").value(2));
    }

    @Test void kpiWorkspaceDraftsWithLegacyNullTeamAreCountedAndAnOlderSavedDraftDoesNotOverrideReview() throws Exception {
        tx.executeWithoutResult(status->{
            var team=em.find(ProjectTeam.class,teamA);workspace(team);
            em.persist(MilestoneArtifactDraft.create(milestoneA,projectA,tenantId,UUID.randomUUID(),now.minusSeconds(30),"{}"));
            var stage=milestone(team,now.plusSeconds(86400),false);
            em.persist(MilestoneArtifactDraft.create(stage.getId(),projectA,tenantId,UUID.randomUUID(),now.minusSeconds(30),"{}"));
            kpiSubmission(stage,SubmissionStatus.CHANGES_REQUESTED);
        });
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.overview.artifactStatuses.DRAFT").value(1))
                .andExpect(jsonPath("$.overview.artifactStatuses.CHANGES_REQUESTED").value(1));
    }

    SprintBacklog kpiItem(ProjectTeam team,SprintBacklogStatus state,Instant due,com.example.starter_project_2025.system.project.sprint.Sprint sprint) {
        var item=new SprintBacklog();item.setProjectId(team.getProjectId());item.setTitle("KPI item");item.setStatus(state);
        item.setEndDate(due==null?null:LocalDateTime.ofInstant(due,ZoneId.of("Asia/Ho_Chi_Minh")));item.setSprint(sprint);
        em.persist(item);em.flush();return item;
    }
    com.example.starter_project_2025.system.project.sprint.Sprint kpiSprint(ProjectTeam team,com.example.starter_project_2025.system.project.sprint.SprintStatus state) {
        var sprint=new com.example.starter_project_2025.system.project.sprint.Sprint();sprint.setName("KPI sprint "+state);
        sprint.setProjectId(team.getProjectId());sprint.setTeamId(team.getId());sprint.setStatus(state);
        sprint.setStartDate(LocalDateTime.ofInstant(now.minusSeconds(86400),ZoneOffset.UTC));
        sprint.setEndDate(LocalDateTime.ofInstant(now.plusSeconds(86400),ZoneOffset.UTC));em.persist(sprint);em.flush();return sprint;
    }
    void kpiSubtask(ProjectTeam team,SprintBacklog parent,com.example.starter_project_2025.system.project.task.TaskStatus state,Instant due) {
        var links=em.createQuery("select p from TaskAlertProjectLink p where p.projectId=:project",com.example.starter_project_2025.system.project.task.alert.TaskAlertData.ProjectLink.class)
                .setParameter("project",team.getProjectId()).getResultList();
        var link=links.isEmpty()?new com.example.starter_project_2025.system.project.task.alert.TaskAlertData.ProjectLink():links.getFirst();
        if(links.isEmpty()){link.setId(UUID.randomUUID());link.setProjectId(team.getProjectId());link.setTenantId(tenantId);em.persist(link);}
        em.persist(com.example.starter_project_2025.system.project.task.Task.builder().projectId(link.getId()).backlogItem(parent)
                .title("KPI subtask").status(state).deadline(due).createdBy(adminId).updatedBy(adminId).build());
    }

    @Test void kpiOverdueIncludesUnassignedBacklogAndSubtasksButExcludesReviewAndInactiveSprints() throws Exception {
        tx.executeWithoutResult(status->{
            var team=em.find(ProjectTeam.class,teamA);workspace(team);
            var active=kpiSprint(team,com.example.starter_project_2025.system.project.sprint.SprintStatus.ACTIVE);
            var planned=kpiSprint(team,com.example.starter_project_2025.system.project.sprint.SprintStatus.PLANNED);
            var closed=kpiSprint(team,com.example.starter_project_2025.system.project.sprint.SprintStatus.COMPLETED);
            var parent=kpiItem(team,SprintBacklogStatus.TODO,now.minusSeconds(1),active);
            kpiItem(team,SprintBacklogStatus.IN_PROGRESS,now.minusSeconds(1),null);
            kpiItem(team,SprintBacklogStatus.REVIEW,now.minusSeconds(1),active);
            kpiItem(team,SprintBacklogStatus.DONE,now.minusSeconds(1),active);
            kpiItem(team,SprintBacklogStatus.TODO,null,active);
            kpiItem(team,SprintBacklogStatus.TODO,now,active);
            var waiting=kpiItem(team,SprintBacklogStatus.TODO,now.minusSeconds(1),planned);
            var finished=kpiItem(team,SprintBacklogStatus.TODO,now.minusSeconds(1),closed);
            var todo=com.example.starter_project_2025.system.project.task.TaskStatus.TODO;
            kpiSubtask(team,parent,todo,now.minusSeconds(1));
            kpiSubtask(team,parent,com.example.starter_project_2025.system.project.task.TaskStatus.IN_PROGRESS,now.minusSeconds(1));
            kpiSubtask(team,parent,com.example.starter_project_2025.system.project.task.TaskStatus.REVIEW,now.minusSeconds(1));
            kpiSubtask(team,parent,todo,now);
            kpiSubtask(team,waiting,todo,now.minusSeconds(1));kpiSubtask(team,finished,todo,now.minusSeconds(1));
        });
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.overview.overdueBacklogItems").value(2))
                .andExpect(jsonPath("$.overview.overdueSubtasks").value(2)).andExpect(jsonPath("$.overview.overdueTasks").value(4))
                .andExpect(jsonPath("$.overview.milestoneRisks").value(1)).andExpect(jsonPath("$.overview.riskCount").value(5));
    }

    @Test void kpiMilestoneRiskCountsCurrentObjectsOnceAndExcludesWaiversAndAccepted() throws Exception {
        tx.executeWithoutResult(status->{
            var team=em.find(ProjectTeam.class,teamA);workspace(team);
            var rejected=milestone(team,now.minusSeconds(20),false);kpiSubmission(rejected,SubmissionStatus.REJECTED);
            var waived=milestone(team,now.minusSeconds(20),false);
            em.persist(MilestoneWaiver.create(tenantId,projectA,waived.getId(),teamA,"Approved exemption",UUID.randomUUID(),now));
            var review=milestone(team,now.minusSeconds(20),false);kpiSubmission(review,SubmissionStatus.SUBMITTED);
            milestone(team,now.minusSeconds(20),true);
            var submitted=milestone(team,now.plusSeconds(20),false);kpiSubmission(submitted,SubmissionStatus.SUBMITTED);
        });
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.overview.milestoneRisks").value(3))
                .andExpect(jsonPath("$.overview.milestoneStatuses.WAIVED").value(1))
                .andExpect(jsonPath("$.overview.milestoneStatuses.ACCEPTED").value(1));
    }

    @Test void kpiExcludesArchivedWorkspacesAndCompletedProjectsWithoutHidingReportHistory() throws Exception {
        tx.executeWithoutResult(status->{
            var a=em.find(ProjectTeam.class,teamA);var b=em.find(ProjectTeam.class,teamB);
            em.find(Workspace.class,workspace(a)).setStatus(WorkspaceStatus.ARCHIVED);
            workspace(b);b.getProject().setStatus(ProjectStatus.COMPLETED);
            kpiSubmission(em.find(Milestone.class,milestoneA),SubmissionStatus.SUBMITTED);
        });
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.overview.activeMasters").value(0)).andExpect(jsonPath("$.overview.activeTeams").value(0))
                .andExpect(jsonPath("$.overview.artifactStatuses.SUBMITTED").value(0)).andExpect(jsonPath("$.overview.riskCount").value(0));
    }

    @Test void kpiEmptyScopeAndLegacyAc02KeepEmptyClassesOutOfOptionsAndRejectExplicitIds() throws Exception {
        Long emptyClass=tx.execute(status->school(em.find(Tenant.class,tenantId),99901L).getId());
        var options=body(mvc.perform(get("/api/project-reports/options").header("Authorization","Bearer "+admin)).andExpect(status().isOk()));
        for(var school:options.get("classes"))assertThat(school.get("id").asLong()).isNotEqualTo(emptyClass);
        for(var cohort:options.get("cohorts"))assertThat(cohort.get("id").asLong()).isNotEqualTo(100001L);
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",emptyClass.toString())).andExpect(status().isForbidden());
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("cohortId","100001")).andExpect(status().isForbidden());
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+manager))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.overview.activeMasters").value(0)).andExpect(jsonPath("$.overview.riskCount").value(0))
                .andExpect(jsonPath("$.overview.milestoneStatuses.IN_PROGRESS").value(0))
                .andExpect(jsonPath("$.overview.artifactStatuses.SUBMITTED").value(0));
    }

    @Test void kpiInactivityUsesActorContributionsWithoutRequiringPendingTasks() throws Exception {
        Long[] people=tx.execute(status->{
            var team=em.find(ProjectTeam.class,teamA);workspace(team);var result=new ArrayList<Long>();
            for(int index=0;index<2;index++) {
                var student=user(em.find(Tenant.class,tenantId),roles.findByName("STUDENT").orElseThrow(),"KPI student "+index);
                var cm=new ClassMember();cm.setTrainingClass(team.getTrainingClass());cm.setUser(student);cm.setStatus(ClassMemberStatus.ACTIVE);em.persist(cm);
                var member=new ProjectMember();member.setTeam(team);member.setClassMember(cm);member.setRole("MEMBER");em.persist(member);em.flush();
                em.createNativeQuery("update project_members set created_at=:at where id=:id")
                        .setParameter("at",java.sql.Timestamp.valueOf(LocalDateTime.ofInstant(now.minus(Duration.ofDays(10)),ZoneId.systemDefault())))
                        .setParameter("id",member.getId()).executeUpdate();result.add(student.getId());
            }
            var action=com.example.starter_project_2025.system.project.activity.ProjectActivityLog.builder()
                    .projectId(projectA).actorId(result.getFirst()).actionType("TASK_UPDATED").entityType("TASK")
                    .occurredAt(LocalDateTime.ofInstant(now.minusSeconds(60),ZoneId.systemDefault())).build();em.persist(action);em.flush();
            // CreationTimestamp is wall-clock based; freeze the fixture's contribution time explicitly.
            em.createNativeQuery("update project_activity_log set occurred_at=:at where id=:id")
                    .setParameter("at",java.sql.Timestamp.valueOf(LocalDateTime.ofInstant(now.minusSeconds(60),ZoneId.systemDefault())))
                    .setParameter("id",action.getId()).executeUpdate();
            return result.toArray(Long[]::new);
        });
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.overview.inactiveMembers").value(1));
        tx.executeWithoutResult(status->{
            var user=em.find(User.class,people[1]);
            em.persist(MilestoneArtifactSubmission.submit(tenantId,projectA,teamA,milestoneA,
                    UUID.nameUUIDFromBytes(user.getEmail().getBytes(StandardCharsets.UTF_8)),1,"https://example.test",null,null,"{}","[]",now,false,BigDecimal.ZERO));
        });
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.overview.inactiveMembers").value(0));
    }

    @Test void kpiSplitCountsTheMasterOnceAndHonorsTeamFilterWithoutSiblingMilestones() throws Exception {
        Long root=splitHierarchy();
        tx.executeWithoutResult(status->{
            workspace(em.find(ProjectTeam.class,teamA));workspace(em.find(ProjectTeam.class,teamB));
            var shared=Milestone.create(tenantId,root,null,"Shared delivery",null,now.plusSeconds(86400),true,
                    UUID.randomUUID(),null,LatePolicyType.NO_LATE,null,null,UUID.randomUUID(),now);
            shared.configureAssessment(new BigDecimal("100"),LatePenaltyBasis.FIXED);
            shared.openForWork(UUID.randomUUID(),now);shared.start(UUID.randomUUID(),now);em.persist(shared);
        });
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.overview.activeMasters").value(1))
                .andExpect(jsonPath("$.overview.activeTeams").value(2))
                .andExpect(jsonPath("$.overview.milestoneStatuses.IN_PROGRESS").value(2))
                .andExpect(jsonPath("$.overview.milestoneStatuses.ACCEPTED").value(1));
        report(mentor).andExpect(status().isOk()).andExpect(jsonPath("$.overview.activeMasters").value(1))
                .andExpect(jsonPath("$.overview.activeTeams").value(1))
                .andExpect(jsonPath("$.overview.milestoneStatuses.IN_PROGRESS").value(2))
                .andExpect(jsonPath("$.overview.milestoneStatuses.ACCEPTED").value(0));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("teamId",teamA.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.overview.activeMasters").value(1))
                .andExpect(jsonPath("$.overview.activeTeams").value(1))
                .andExpect(jsonPath("$.overview.milestoneStatuses.IN_PROGRESS").value(1))
                .andExpect(jsonPath("$.overview.milestoneStatuses.ACCEPTED").value(0));
    }

    void feedEvent(Long project, String correlation, Instant at) {
        em.createNativeQuery("insert into project_activity_log(project_id,actor_id,actor_display_name,action_type,entity_type,entity_id,"
                        + "before_state,after_state,correlation_id,occurred_at) values (:project,:actor,'Admin','TASK_STATUS_CHANGED','TASK',999999,"
                        + ":before,:after,:correlation,:at)")
                .setParameter("project", project).setParameter("actor", adminId)
                .setParameter("before", "{\"status\":\"IN_PROGRESS\",\"privateNote\":\"PRIVATE_FEEDBACK_NOT_FOR_FEED\"}")
                .setParameter("after", "{\"status\":\"DONE\"}").setParameter("correlation", correlation)
                .setParameter("at", LocalDateTime.ofInstant(at, ZoneId.systemDefault())).executeUpdate();
    }

    @Test void workCountsMainWorkspaceAndKanbanItemsButNeverUuidSubtasksAndKeepsSprintSelectionLocal() throws Exception {
        Long[] ids = tx.execute(status -> {
            var team = em.find(ProjectTeam.class, teamA);
            var sprint = kpiSprint(team, com.example.starter_project_2025.system.project.sprint.SprintStatus.ACTIVE);
            var ownItems = em.createQuery("select b from SprintBacklog b where b.projectId=:id", SprintBacklog.class)
                    .setParameter("id", projectA).getResultList();
            ownItems.forEach(item -> item.setSprint(sprint));
            kpiSubtask(team, ownItems.getFirst(), com.example.starter_project_2025.system.project.task.TaskStatus.TODO, now.plusSeconds(60));
            var task = new com.example.starter_project_2025.system.project.sprint.Task();
            task.setProjectId(projectA);task.setTeamId(teamA);task.setSprintId(sprint.getId());task.setTitle("Kanban primary task");
            task.setCode("RPT-MAIN");task.setStatus(com.example.starter_project_2025.system.project.sprint.TaskStatus.IN_PROGRESS);em.persist(task);em.flush();
            return new Long[]{sprint.getId(), task.getId()};
        });
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.work.backlog.total").value(3))
                .andExpect(jsonPath("$.work.backlog.todo").value(1)).andExpect(jsonPath("$.work.backlog.inProgress").value(1))
                .andExpect(jsonPath("$.work.backlog.done").value(1)).andExpect(jsonPath("$.work.backlog.percent").doesNotExist());
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("classId",classId.toString()).param("workSprintId",ids[0].toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.work.selectedSprintId").value(ids[0]))
                .andExpect(jsonPath("$.work.backlog.total").value(3)).andExpect(jsonPath("$.summary.masters").value(2));
        tx.executeWithoutResult(status -> em.find(com.example.starter_project_2025.system.project.sprint.Task.class, ids[1])
                .setStatus(com.example.starter_project_2025.system.project.sprint.TaskStatus.DONE));
        report(admin).andExpect(status().isOk()).andExpect(jsonPath("$.work.backlog.inProgress").value(0)).andExpect(jsonPath("$.work.backlog.done").value(2));
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+mentor).param("teamId",teamB.toString()).param("workSprintId",ids[0].toString()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("teamId",teamB.toString()).param("workSprintId",ids[0].toString()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+admin).header("Idempotency-Key",UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON).content("{\"filters\":{\"teamId\":"+teamB+",\"workSprintId\":"+ids[0]+"}}"))
                .andExpect(status().isForbidden());
    }

    @Test void activityFeedAggregatesAllMatchingMastersBeforePaginationDeduplicatesAndDoesNotExposeRawNotes() throws Exception {
        tx.executeWithoutResult(status -> {
            for (int i=0;i<12;i++) feedEvent(projectA,"feed-a-"+i,now.minusSeconds(i+1));
            feedEvent(projectA,"feed-a-0",now.minusSeconds(1));
            feedEvent(projectB,"feed-b",now.minusSeconds(2));
            feedEvent(projectA,"future",now.plusSeconds(1));
        });
        var first = body(mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin)
                .param("classId",classId.toString()).param("size","1")).andExpect(status().isOk()));
        assertThat(first.get("content")).hasSize(1);
        assertThat(first.get("activities").get("content")).hasSize(10);
        assertThat(first.get("activities").get("hasMore").asBoolean()).isTrue();
        assertThat(first.get("activities").get("content").findValuesAsText("projectId")).contains(projectA.toString(),projectB.toString());
        assertThat(first.get("activities").toString()).doesNotContain("PRIVATE_FEEDBACK_NOT_FOR_FEED", "beforeState", "afterState");
        var next = body(mvc.perform(get("/api/project-reports/activities").header("Authorization","Bearer "+admin)
                .param("classId",classId.toString()).param("offset","10").param("before",first.get("activities").get("asOf").asText()))
                .andExpect(status().isOk()));
        assertThat(next.get("content")).hasSize(3);
        assertThat(next.get("hasMore").asBoolean()).isFalse();
        assertThat(next.get("content").findValuesAsText("id")).doesNotContainAnyElementsOf(first.get("activities").get("content").findValuesAsText("id"));
        var mine = body(report(mentor).andExpect(status().isOk())).get("activities");
        assertThat(mine.get("content").findValuesAsText("projectId")).containsOnly(projectA.toString());
        mvc.perform(get("/api/project-reports/activities").header("Authorization","Bearer "+admin).param("limit","0"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/project-reports/activities").header("Authorization","Bearer "+student)).andExpect(status().isForbidden());
    }

    @Test void activityHistoryPaginatesTwoHundredDailyEventsAndPinsItsSnapshot() throws Exception {
        tx.executeWithoutResult(status -> {
            for (int i=0;i<205;i++) feedEvent(projectA,"history-"+i,now.minusSeconds(i+1));
            feedEvent(projectA,"history-0",now.minusSeconds(1));
            feedEvent(projectB,"history-other-team",now.minusSeconds(1));
            feedEvent(projectA,"history-old",now.minusSeconds(10*86400));
            feedEvent(projectA,"history-future",now.plusSeconds(60));
        });
        var first=body(mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+mentor))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(205))
                .andExpect(jsonPath("$.size").value(20)).andExpect(jsonPath("$.content.length()").value(20)));
        var next=body(mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+mentor)
                .param("historyPage","1").param("before",first.get("asOf").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(205))
                .andExpect(jsonPath("$.content.length()").value(20)));
        var ids=new HashSet<String>();first.get("content").forEach(row->ids.add(row.get("id").asText()));
        next.get("content").forEach(row->assertThat(ids.add(row.get("id").asText())).isTrue());
        assertThat(first.toString()).doesNotContain("PRIVATE_FEEDBACK_NOT_FOR_FEED");
        assertThat(first.get("content").findValuesAsText("projectId")).containsOnly(projectA.toString());
        mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+mentor).param("historyPage","10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(5));
        when(clock.instant()).thenReturn(now.plusSeconds(120));
        mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+mentor)
                        .param("historyPage","1").param("before",first.get("asOf").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(205));
        mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+mentor))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(206));
    }

    @Test void activityHistoryDatesUseReportTimezoneAndIncludeTheWholeSelectedDayAcrossSources() throws Exception {
        var start=LocalDate.of(2026,10,29).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
        var end=start.plusSeconds(86400);
        tx.executeWithoutResult(status -> {
            feedEvent(projectA,"before-day",start.minusMillis(1));feedEvent(projectA,"day-start",start);
            feedEvent(projectA,"day-end",end.minusMillis(1));feedEvent(projectA,"after-day",end);
            em.persist(com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog.statusEvent(
                    milestoneA,projectA,tenantId,UUID.randomUUID(),"MILESTONE_STARTED","instant-start",null,start));
            em.persist(com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog.statusEvent(
                    milestoneA,projectA,tenantId,UUID.randomUUID(),"MILESTONE_UPDATED","instant-end",null,end.minusMillis(1)));
        });
        var response=body(mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+mentor)
                        .param("activityFrom","2026-10-29").param("activityTo","2026-10-29"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(4))
                .andExpect(jsonPath("$.activityFrom").value("2026-10-29")).andExpect(jsonPath("$.activityTo").value("2026-10-29")));
        response.get("content").forEach(row -> assertThat(Instant.parse(row.get("occurredAt").asText())).isBetween(start,end.minusMillis(1)));
        mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+mentor)
                        .param("activityFrom","2026-01-01").param("activityTo","2026-01-01"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.content").isEmpty());
    }

    @Test void activityHistoryKeepsScopeChecksAndRejectsInvalidDatesOrPagination() throws Exception {
        mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+mentor).param("teamId",teamB.toString()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+student)).andExpect(status().isForbidden());
        mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+admin)
                        .param("activityFrom","2026-10-30").param("activityTo","2026-10-29"))
                .andExpect(status().isUnprocessableEntity());
        for(var params:List.of(Map.of("historyPage","-1"),Map.of("historySize","51"),Map.of("before",now.plusSeconds(1).toString()))) {
            var request=get("/api/project-reports/activities/history").header("Authorization","Bearer "+admin);
            params.forEach(request::param);mvc.perform(request).andExpect(status().isUnprocessableEntity());
        }
        mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+admin).param("historyPage","2147483647"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
    }

    @Test void masterFilterNarrowsProjectsWorkAndActivityWithoutGrantingUnreadableAncestors() throws Exception {
        Long root = splitHierarchy();
        tx.executeWithoutResult(status -> {
            feedEvent(projectA,"own-module",now.minusSeconds(1));
            feedEvent(projectB,"other-module",now.minusSeconds(2));
            feedEvent(root,"shared-master",now.minusSeconds(3));
        });
        var result = body(mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("masterId",root.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)));
        assertThat(result.get("activities").get("content").findValuesAsText("projectId")).contains(projectA.toString(),projectB.toString(),root.toString());
        var filtered = body(mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+mentor)
                .param("masterId",root.toString()).param("teamId",teamA.toString())).andExpect(status().isOk()));
        assertThat(filtered.get("activities").get("content").findValuesAsText("projectId")).containsOnly(projectA.toString());
        assertThat(filtered.get("activities").get("content").findValuesAsText("teamId")).containsOnly(teamA.toString());
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+admin).param("masterId","9223372036854775807"))
                .andExpect(status().isForbidden());
    }

    @Test void deliveryRowsAndFeedUseCurrentVersionAndReviewLinksWithoutDuplicatingLegacyArtifactCopies() throws Exception {
        tx.executeWithoutResult(status -> {
            workspace(em.find(ProjectTeam.class,teamA));
            var submission = kpiSubmission(em.find(Milestone.class,milestoneA), SubmissionStatus.CHANGES_REQUESTED);
            int next = submission.openNextDraft(now);
            var version = SubmissionVersion.draft(submission,next,"Revised delivery",null,null,UUID.randomUUID(),now);
            em.persist(version);version.submit(now,false,BigDecimal.ZERO);submission.submitted(next,now);
            em.flush();
            var copy = MilestoneArtifactSubmission.submit(tenantId,projectA,teamA,milestoneA,submission.getStudentId(),next,null,null,null,"[]","[]",now.minusSeconds(1),false,null);
            em.persist(copy);em.flush();version.linkArtifactSubmission(copy.getId());
            em.persist(SubmissionAuditLog.create(submission.getId(),version.getId(),"SUBMISSION_SUBMITTED",submission.getStudentId(),"revision-submit",now.minusSeconds(1)));
            em.persist(com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog.statusEvent(milestoneA,projectA,tenantId,
                    submission.getStudentId(),"MILESTONE_SUBMITTED","revision-submit",null,now.minusSeconds(1)));
        });
        var result = body(report(mentor).andExpect(status().isOk()));
        assertThat(result.get("deliveries")).hasSize(1);
        var row = result.get("deliveries").get(0);
        assertThat(row.get("version").asInt()).isEqualTo(2);
        assertThat(row.get("artifactStatus").asText()).isEqualTo("SUBMITTED");
        assertThat(row.get("milestoneStatus").asText()).isEqualTo("SUBMITTED");
        assertThat(result.get("overview").get("artifactStatuses").get("SUBMITTED").asInt()).isEqualTo(1);
        assertThat(result.get("activities").get("content")).hasSize(1);
        var event = result.get("activities").get("content").get(0);
        assertThat(event.get("subject").asText()).contains("v2");
        assertThat(event.get("href").asText()).isEqualTo("/milestone-submissions/"+row.get("submissionId").asText()+"/review");
    }

    @Test void activityExcelExportsAllScopedEventsBeyondPreviewHistoryPagesAndTheRecentDateWindow() throws Exception {
        tx.executeWithoutResult(status -> {
            for(int i=0;i<205;i++)feedEvent(projectA,"excel-volume-"+i,now.minusSeconds(i+1));
            feedEvent(projectA,"excel-old-event",now.minusSeconds(10*86400));
            feedEvent(projectB,"excel-other-team",now.minusSeconds(1));
        });
        mvc.perform(get("/api/project-reports").header("Authorization","Bearer "+mentor).param("teamId",teamA.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activities.content.length()").value(10));
        mvc.perform(get("/api/project-reports/activities/history").header("Authorization","Bearer "+mentor).param("teamId",teamA.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(205)).andExpect(jsonPath("$.content.length()").value(20));
        var request=mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+mentor)
                .header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"format\":\"EXCEL\",\"filters\":{\"teamId\":"+teamA+",\"page\":1,\"size\":1}}"));
        UUID jobId=UUID.fromString(body(request.andExpect(status().isAccepted())).get("id").asText());
        exports.process(jobId);
        byte[] bytes=mvc.perform(get("/api/project-reports/exports/{id}/download",jobId).header("Authorization","Bearer "+mentor))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        String expectedCode=tx.execute(status->em.find(Project.class,projectA).getCode());
        try(var book=WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            assertThat(book.getNumberOfSheets()).isEqualTo(6);
            var events=book.getSheet("Hoạt động");
            assertThat(events.getLastRowNum()-ProjectReportExcelWriter.HEADER_ROW).isEqualTo(206);
            for(int row=ProjectReportExcelWriter.HEADER_ROW+1;row<=events.getLastRowNum();row++)
                assertThat(events.getRow(row).getCell(2).getStringCellValue()).isEqualTo(expectedCode);
            assertThat(events.getRow(events.getLastRowNum()).getCell(0).getLocalDateTimeCellValue())
                    .isEqualTo(LocalDateTime.ofInstant(now.minusSeconds(10*86400),ZoneId.of("Asia/Ho_Chi_Minh")));
        }
    }

    @Test void expandedExcelIncludesNewScopedFieldsNumericCountsActivityAndSuccessfulExportAudit() throws Exception {
        tx.executeWithoutResult(status -> {
            em.find(TrainingClass.class,classId).setProgramName(null);
            workspace(em.find(ProjectTeam.class,teamA));kpiSubmission(em.find(Milestone.class,milestoneA),SubmissionStatus.SUBMITTED);
            feedEvent(projectA,"excel-own",now.minusSeconds(1));feedEvent(projectB,"excel-other",now.minusSeconds(2));
        });
        var response = mvc.perform(post("/api/project-reports/exports").header("Authorization","Bearer "+admin)
                .header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"format\":\"EXCEL\",\"filters\":{\"programId\":801,\"teamId\":"+teamA+"}}"));
        UUID id = UUID.fromString(body(response.andExpect(status().isAccepted())).get("id").asText());exports.process(id);
        byte[] bytes = mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try (var book = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            assertThat(book.getNumberOfSheets()).isEqualTo(6);
            assertThat(book.getSheetAt(0).getRow(3).getCell(0).getStringCellValue()).contains("Chương trình: #801");
            assertThat(book.getSheet("Tổng quan").getRow(ProjectReportExcelWriter.HEADER_ROW+1).getCell(1).getCellType())
                    .isEqualTo(org.apache.poi.ss.usermodel.CellType.NUMERIC);
            assertThat(book.getSheet("Milestone và bài nộp").getRow(ProjectReportExcelWriter.HEADER_ROW+1).getCell(7).getStringCellValue()).isEqualTo("Chờ duyệt");
            var events = book.getSheet("Hoạt động");
            assertThat(events.getLastRowNum()-ProjectReportExcelWriter.HEADER_ROW).isEqualTo(1);
            assertThat(events.getRow(ProjectReportExcelWriter.HEADER_ROW+1).getCell(2).getStringCellValue())
                    .isEqualTo(tx.execute(status -> em.find(Project.class,projectA).getCode()));
        }
        Long auditCount = tx.execute(status -> em.createQuery("select count(a) from ProjectReportExportAudit a where a.jobId=:id "
                        + "and a.action='EXPORT_MOCK_PROJECT_DASHBOARD'",Long.class).setParameter("id",id).getSingleResult());
        assertThat(auditCount).isEqualTo(1L);
    }
}
