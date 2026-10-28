package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.system.schedule.generation.*;
import com.example.starter_project_2025.system.study_session.*;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("local") @Transactional
class TeachingAssignmentIntegrationFlowTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ClassTrainingProgramRepository links;
    @Autowired StudySessionRepository study;
    @Autowired SessionRepository demo;
    @Autowired AssignmentScheduleValidation validation;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired com.example.starter_project_2025.system.rbac.user.UserRepository users;
    @Autowired com.example.starter_project_2025.system.rbac.role.RoleRepository roles;
    @Autowired com.example.starter_project_2025.system.rbac.permission.PermissionRepository permissions;
    @MockBean ScheduleReferenceProvider references;
    @SpyBean ExternalApiService external;
    private Long id, psId, subjectId;
    private String bearer;

    @BeforeEach void setup() throws Exception {
        var clazz=external.fetchClassById(1L);clazz.setStartDate("2026-01-01");clazz.setEndDate("2026-12-31");
        doReturn(clazz).when(external).fetchClassById(1L);
        new TransactionTemplate(transactions).executeWithoutResult(tx->{
            var ps=links.findByClassId(1L).orElseThrow().getProgram().getSubjects().get(0);
            psId=ps.getId();subjectId=ps.getSubject().getId();
            var a=new TeachingAssignment();a.setClassId(1L);a.setProgramSubject(ps);a.setTrainerId(1L);a.setRole(AssignmentRole.MAIN);
            a.setEffectiveFrom(LocalDate.of(2026,1,1));a.setEffectiveTo(LocalDate.of(2026,12,31));id=assignments.saveAndFlush(a).getId();
        });
        var resources=new ScheduleReferences(List.of(clazz),external.fetchTrainers(null),external.fetchRooms(),
                List.of(new ScheduleReferences.Assignment(id,1L,subjectId,1L,LocalDate.of(2026,1,1),LocalDate.of(2026,12,31),"ACTIVE")),List.of());
        when(references.loadResources()).thenReturn(resources);when(references.load()).thenReturn(resources);
        String body=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email","admin@example.com","password","password123"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        bearer="Bearer "+json.readTree(body).get("accessToken").asText();
    }
    @AfterEach void cleanup() {
        new TransactionTemplate(transactions).executeWithoutResult(tx->{
            study.deleteAll(study.findAll().stream().filter(s->id.equals(s.getTeachingAssignmentId())).toList());
            demo.deleteAll(demo.findByClassId(1L).stream().filter(s->id.equals(s.getTeachingAssignmentId())).toList());
            if(assignments.existsById(id)) assignments.deleteById(id);
            jdbc.update("delete from bulk_schedule_receipts");
        });
    }
    @Test void availabilityUsesProgramSubjectAndWholeIntervalAndRejectsAmbiguousParameters() throws Exception {
        mvc.perform(get("/api/classes/1/teaching-assignments/available").header("Authorization",bearer)
                        .param("programSubjectId",psId.toString()).param("from","2026-11-02T09:00:00").param("to","2026-11-02T11:00:00"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(get("/api/classes/1/teaching-assignments/available").header("Authorization",bearer)
                        .param("date","2026-11-02").param("from","2026-11-02T09:00:00").param("to","2026-11-02T11:00:00"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/classes/1/teaching-assignments/available").header("Authorization",bearer)
                        .param("from","2026-12-31T09:00:00").param("to","2027-01-01T10:00:00"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        assignments.findById(id).orElseThrow().setIsActive(false);assignments.flush();
        mvc.perform(get("/api/classes/1/teaching-assignments/available").header("Authorization",bearer).param("date","2026-11-02"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void studySessionIsVisibleInHistoryAndBlocksEndAndDelete() throws Exception {
        long sessionId=createStudy();assignments.flush();
        mvc.perform(get(path("/sessions")).header("Authorization",bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].source").value("STUDY_SESSION")).andExpect(jsonPath("$.content[0].id").value(sessionId));
        mvc.perform(get(path("/lifecycle-context")).header("Authorization",bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.linkedSessionCount").value(1)).andExpect(jsonPath("$.canDelete").value(false));
        mvc.perform(post(path("/end-preview")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(endBody()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.affectedSessions.content[0].session.source").value("STUDY_SESSION"));
        mvc.perform(patch(path("/end")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(endBody()))
                .andExpect(status().isConflict());
        mvc.perform(delete(path("")).header("Authorization",bearer).param("revision",revision())).andExpect(status().isConflict());
    }
    @Test void equalNumericIdsRemainSeparateAndStudyEditDoesNotExcludeDemoBooking() throws Exception {
        long sessionId=createStudy();
        jdbc.update("insert into sessions (id,class_id,topic_id,trainer_id,title,start_time,end_time,status,is_active,meeting_url,teaching_assignment_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                sessionId,1L,subjectId,1L,"Legacy booking",LocalDateTime.parse("2026-11-02T09:00:00"),LocalDateTime.parse("2026-11-02T10:00:00"),"SCHEDULED",true,"https://example.com/legacy",id);
        mvc.perform(get(path("/sessions")).header("Authorization",bearer).param("size","1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.content[0].source").value("DEMO_SESSION"));
        mvc.perform(get(path("/sessions")).header("Authorization",bearer).param("size","1").param("page","1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].source").value("STUDY_SESSION"));
        var result=validation.preview(List.of(proposal(new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION,sessionId),"2026-11-02T09:00:00","2026-11-02T10:00:00")));
        assertThat(result.valid()).isFalse();
        assertThat(result.issues()).anyMatch(e->e.relatedEntryKey()!=null && e.relatedEntryKey().source()==ScheduleEntryKey.Source.DEMO_SESSION);
    }
    @Test void cancelledStudyHistoryCanEndButPreviousUseSurvivesPhysicalRemoval() throws Exception {
        long sessionId=createStudy();assignments.flush();
        mvc.perform(patch("/api/study-sessions/{id}/cancel",sessionId).header("Authorization",bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Cancelled for integration test\"}")).andExpect(status().isOk());
        mvc.perform(patch(path("/end")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(endBody())).andExpect(status().isOk());
        mvc.perform(delete("/api/study-sessions/{id}",sessionId).header("Authorization",bearer)).andExpect(status().isNoContent());study.flush();assignments.flush();
        mvc.perform(get(path("/lifecycle-context")).header("Authorization",bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.linkedSessionCount").value(0)).andExpect(jsonPath("$.previouslyUsed").value(true));
        mvc.perform(delete(path("")).header("Authorization",bearer).param("revision",revision())).andExpect(status().isConflict());
    }
    @Test void previewIsReadOnlyAndAdjacentSessionsDoNotOverlap() throws Exception {
        var proposed=proposal(null,"2026-11-02T09:00:00","2026-11-02T10:00:00");
        mvc.perform(post("/api/schedule-checks/scoped").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("sessions",List.of(proposed)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));
        assertThat(assignments.findById(id).orElseThrow().getEverUsed()).isFalse();
        createStudy();
        assertThat(validation.preview(List.of(proposal(null,"2026-11-02T10:00:00","2026-11-02T11:00:00"))).valid()).isTrue();
        assertThat(validation.preview(List.of(proposed)).valid()).isFalse();
    }
    @Test void generatorPreviewPermissionDoesNotGrantStudyWriteOrEditExclusion() throws Exception {
        var role=new com.example.starter_project_2025.system.rbac.role.Role();role.setName("P6_GENERATOR_ONLY");
        role.setPermissions(new HashSet<>(Set.of(permissions.findByName("SESSION_CREATE").orElseThrow())));roles.saveAndFlush(role);
        var user=users.findByEmail("teacher@example.com").orElseThrow();user.setRoles(new HashSet<>(Set.of(role)));users.saveAndFlush(user);
        String login=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"teacher@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token="Bearer "+json.readTree(login).get("accessToken").asText();
        var proposal=proposal(null,"2026-11-02T09:00:00","2026-11-02T10:00:00");
        mvc.perform(post("/api/schedule-checks/scoped").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("sessions",List.of(proposal)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));
        var edit=proposal(new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION,999L),"2026-11-02T09:00:00","2026-11-02T10:00:00");
        mvc.perform(post("/api/schedule-checks/scoped").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("sessions",List.of(edit)))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/study-sessions").header("Authorization",token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(studyBody())))
                .andExpect(status().isForbidden());
    }
    @Test void updatingAStudySessionCannotReplaceItsPersistentIdentity() throws Exception {
        long sessionId=createStudy();
        mvc.perform(put("/api/study-sessions/{id}",sessionId).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"id\":999999,\"title\":\"Updated integration lesson\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(sessionId));
        assertThat(study.existsById(999999L)).isFalse();
        assertThat(study.findById(sessionId).orElseThrow().getTeachingAssignmentId()).isEqualTo(id);
    }
    @Test void legacySessionWritesAlsoSeeStudyBookings() throws Exception {
        createStudy();
        var body=Map.of("classId",1,"topicId",subjectId,"trainerId",1,"teachingAssignmentId",id,"title","Legacy collision",
                "startTime","2026-11-02T09:00:00","endTime","2026-11-02T10:00:00","meetingUrl","https://example.com/legacy","isActive",true);
        mvc.perform(post("/api/sessions").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.issues[0].relatedSource").value("STUDY_SESSION"));
        assertThat(demo.countByTeachingAssignmentId(id)).isZero();
    }
    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void bulkSaveUsesStudySessionAndDurableIdempotencyRejectsChangedContent() throws Exception {
        var row=new HashMap<String,Object>();row.put("teachingAssignmentId",id);row.put("programSubjectId",psId);row.put("subjectId",subjectId);
        row.put("trainerId",1);row.put("title","Generated integration lesson");row.put("startTime","2026-11-02T09:00:00");row.put("endTime","2026-11-02T10:00:00");row.put("meetingUrl","https://example.com/bulk");
        String body=json.writeValueAsString(Map.of("sessions",List.of(row)));
        String first=mvc.perform(post("/api/classes/1/schedule-generation/save").header("Authorization",bearer).header("Idempotency-Key","p6-replay")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andExpect(jsonPath("$.createdSessions[0].source").value("STUDY_SESSION"))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(post("/api/classes/1/schedule-generation/save").header("Authorization",bearer).header("Idempotency-Key","p6-replay")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andExpect(content().json(first));
        row.put("title","Changed request content");
        mvc.perform(post("/api/classes/1/schedule-generation/save").header("Authorization",bearer).header("Idempotency-Key","p6-replay")
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("sessions",List.of(row))))).andExpect(status().isConflict());
        assertThat(study.findAll().stream().filter(s->id.equals(s.getTeachingAssignmentId())).count()).isEqualTo(1);
        assertThat(demo.countByTeachingAssignmentId(id)).isZero();
    }
    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void linkedCsvImportRunsTheSameGuardAndKeepsRowLevelFailures() throws Exception {
        String csv="Subject ID,Title,Session Date,Start Time,End Time,Lecturer,Type,Class ID,Teaching Assignment ID,Meeting URL\n"
                +subjectId+",Imported valid lesson,2026-11-02,09:00:00,10:00:00,Trainer One,LECTURE,1,"+id+",https://example.com/import\n"
                +subjectId+",Imported collision lesson,2026-11-02,09:30:00,10:30:00,Trainer One,LECTURE,1,"+id+",https://example.com/import\n";
        mvc.perform(multipart("/api/study-sessions/import").file(new MockMultipartFile("file","sessions.csv","text/csv",csv.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .header("Authorization",bearer)).andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(1)).andExpect(jsonPath("$.failureCount").value(1));
        assertThat(study.findAll().stream().filter(s->id.equals(s.getTeachingAssignmentId())).count()).isEqualTo(1);
        assertThat(assignments.findById(id).orElseThrow().getEverUsed()).isTrue();
    }
    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void invalidBulkRowRollsBackTheEntireBatchAndUsage() throws Exception {
        var good=proposal(null,"2026-11-02T09:00:00","2026-11-02T10:00:00");
        var bad=proposal(null,"2027-01-02T09:00:00","2027-01-02T10:00:00");
        mvc.perform(post("/api/classes/1/schedule-generation/save").header("Authorization",bearer).header("Idempotency-Key","rollback-test")
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("sessions",List.of(good,bad)))))
                .andExpect(status().isConflict());
        assertThat(study.findAll().stream().filter(s->id.equals(s.getTeachingAssignmentId())).count()).isZero();
        assertThat(assignments.findById(id).orElseThrow().getEverUsed()).isFalse();
        assertThat(jdbc.queryForObject("select count(*) from bulk_schedule_receipts",Long.class)).isZero();
    }
    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void studyCreationRacingWithEndingCannotLeaveAnOutOfPeriodSession() throws Exception {
        String create=json.writeValueAsString(studyBody());
        String end=json.writeValueAsString(Map.of("effectiveTo","2026-10-31","revision",0));
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var start=new java.util.concurrent.CountDownLatch(1);
            var first=pool.submit(()->{start.await();return mvc.perform(post("/api/study-sessions").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(create)).andReturn().getResponse().getStatus();});
            var second=pool.submit(()->{start.await();return mvc.perform(patch(path("/end")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(end)).andReturn().getResponse().getStatus();});
            start.countDown();
            var result=List.of(first.get(20,java.util.concurrent.TimeUnit.SECONDS),second.get(20,java.util.concurrent.TimeUnit.SECONDS));
            assertThat(result.equals(List.of(200,409)) || result.equals(List.of(400,200)) || result.equals(List.of(409,200))).as("Race statuses: %s",result).isTrue();
            var a=assignments.findById(id).orElseThrow();
            assertThat(study.findAll().stream().filter(s->id.equals(s.getTeachingAssignmentId())).allMatch(s->!s.getSessionDate().isAfter(a.getEffectiveTo()))).isTrue();
        }
    }
    @Test void generationSelectsAssignmentsForEachDateAcrossATrainerHandover() throws Exception {
        var original=assignments.findById(id).orElseThrow();original.setEffectiveTo(LocalDate.of(2026,11,2));
        var next=new TeachingAssignment();next.setClassId(1L);next.setProgramSubject(original.getProgramSubject());next.setTrainerId(2L);next.setRole(AssignmentRole.MAIN);
        next.setEffectiveFrom(LocalDate.of(2026,11,3));next.setEffectiveTo(LocalDate.of(2026,12,31));assignments.saveAndFlush(next);
        for(var ps:links.findByClassId(1L).orElseThrow().getProgram().getSubjects()) {
            if(ps.getId().equals(psId))continue;
            var a=new TeachingAssignment();a.setClassId(1L);a.setProgramSubject(ps);a.setTrainerId(1L);a.setRole(AssignmentRole.MAIN);
            a.setEffectiveFrom(LocalDate.of(2026,1,1));a.setEffectiveTo(LocalDate.of(2026,12,31));assignments.saveAndFlush(a);
        }
        var request=Map.of("startDate","2026-11-02","daysOfWeek",List.of("MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"),
                "slotTime",Map.of("startTime","09:00:00","hoursPerSession",2),"meetingUrl","https://example.com/generated");
        String response=mvc.perform(post("/api/classes/1/schedule-generation/preview").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var rows=json.readTree(response).get("sessions");
        assertThat(rows.get(0).get("teachingAssignmentId").asLong()).isEqualTo(id);
        assertThat(rows.get(1).get("teachingAssignmentId").asLong()).isEqualTo(next.getId());
        assertThat(rows.get(1).get("programSubjectId").asLong()).isEqualTo(psId);
        assertThat(rows.get(1).get("subjectId").asLong()).isEqualTo(subjectId);
        assertThat(rows.get(1).get("topicId").isNull()).isTrue();
        assertThat(assignments.findById(id).orElseThrow().getEverUsed()).isFalse();
    }
    private AssignmentScheduleProposal proposal(ScheduleEntryKey key,String from,String to){return new AssignmentScheduleProposal(key,id,1L,subjectId,psId,1L,"Integration booking",LocalDateTime.parse(from),LocalDateTime.parse(to),null,"https://example.com/meeting");}
    private long createStudy() throws Exception {
        var body=studyBody();
        var result=mvc.perform(post("/api/study-sessions").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        study.flush();return json.readTree(result).get("id").asLong();
    }
    private Map<String,Object> studyBody() {
        var body=new HashMap<String,Object>();body.put("classId",1);body.put("subjectId",subjectId);body.put("programSubjectId",psId);body.put("teachingAssignmentId",id);
        body.put("title","Integrated study lesson");body.put("lecturer","Trainer One");body.put("type","LECTURE");body.put("sessionDate","2026-11-02");
        body.put("startTime","09:00:00");body.put("endTime","10:00:00");body.put("meetingUrl","https://example.com/meeting");body.put("isActive",true);
        return body;
    }
    private String path(String suffix){return "/api/teaching-assignments/"+id+suffix;}
    private String revision(){assignments.flush();return assignments.findById(id).orElseThrow().getRevision().toString();}
    private String endBody() throws Exception{return json.writeValueAsString(Map.of("effectiveTo","2026-10-31","revision",Long.parseLong(revision())));}
}
