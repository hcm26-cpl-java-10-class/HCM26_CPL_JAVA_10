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
            assertThat(workbook.getNumberOfSheets()).isEqualTo(1);
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
    @Test void hierarchyExcelUsesOneSheetWithMasterAndModuleRowsWithoutInventedPercentages() throws Exception {
        splitHierarchy();var id=export("EXCEL",UUID.randomUUID());exports.process(id);
        byte[] bytes=mvc.perform(get("/api/project-reports/exports/{id}/download",id).header("Authorization","Bearer "+admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try(var workbook=WorkbookFactory.create(new ByteArrayInputStream(bytes))){
            assertThat(workbook.getNumberOfSheets()).isEqualTo(1);
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
            assertThat(workbook.getNumberOfSheets()).isEqualTo(1);
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

}
