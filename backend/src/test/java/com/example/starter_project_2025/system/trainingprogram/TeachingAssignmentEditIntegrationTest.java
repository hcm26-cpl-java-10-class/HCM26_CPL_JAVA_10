package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.schedule.ScheduleReferenceProvider;
import com.example.starter_project_2025.system.schedule.ScheduleReferences;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class TeachingAssignmentEditIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ClassTrainingProgramRepository classPrograms;
    @Autowired ProgramSubjectRepository programSubjects;
    @Autowired SessionRepository sessions;
    @Autowired PlatformTransactionManager transactions;
    @SpyBean ExternalApiService external;
    @MockBean ScheduleReferenceProvider references;
    private String bearer;
    private Long id;
    private Long subjectId;
    private Long programSubjectId;

    @BeforeEach
    void setUp() throws Exception {
        bearer = login("admin@example.com");
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            var programSubject = classPrograms.findByClassId(1L).orElseThrow().getProgram().getSubjects().get(0);
            programSubjectId = programSubject.getId(); subjectId = programSubject.getSubject().getId();
            var a = new TeachingAssignment();
            a.setClassId(1L); a.setProgramSubject(programSubject); a.setTrainerId(1L); a.setRole(AssignmentRole.MAIN);
            a.setEffectiveFrom(LocalDate.of(2026, 1, 1)); a.setEffectiveTo(LocalDate.of(2026, 12, 31));
            id = assignments.saveAndFlush(a).getId();
        });
        var clazz = external.fetchClassById(1L);
        clazz.setStartDate("2026-01-01"); clazz.setEndDate("2026-12-31");
        doReturn(clazz).when(external).fetchClassById(1L);
        // Deliberately stale, wide reference range: local write validation must remain authoritative.
        doReturn(new ScheduleReferences(List.of(clazz), external.fetchTrainers("active"), List.of(),
                List.of(new ScheduleReferences.Assignment(id, 1L, subjectId, 1L,
                        LocalDate.of(2026,1,1), LocalDate.of(2026,12,31), "ACTIVE")), List.of()))
                .when(references).load();
    }

    @Test
    void unchangedAssignmentDoesNotConflictWithItselfAndSafeSaveIncrementsRevision() throws Exception {
        mvc.perform(get(path("/edit-context")).header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.assignment.revision").value(0)).andExpect(jsonPath("$.linkedSessionCount").value(0));
        preview(request()).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(true));
        var body = request(); body.put("role", "ASSISTANT");
        update(body).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1)).andExpect(jsonPath("$.role").value("ASSISTANT"));
    }

    @Test
    void unusedAssignmentCanChangeTrainerWithoutTouchingSessions() throws Exception {
        var body = request(); body.put("trainerId", 2);
        preview(body).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(true));
        update(body).andExpect(status().isOk()).andExpect(jsonPath("$.trainerId").value(2));
        assertThat(sessions.countByTeachingAssignmentId(id)).isZero();
    }

    @Test
    void classAndSubjectCannotBeChangedByTamperingWithRequest() throws Exception {
        for (String field : List.of("classId", "programSubjectId")) {
            var body = request(); body.put(field, 2 + programSubjectId);
            if (field.equals("classId")) body.put(field, 2);
            preview(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors." + field).isArray());
            update(body).andExpect(status().isBadRequest());
        }
        assertThat(assignments.findById(id).orElseThrow().getRevision()).isZero();
    }

    @Test
    void previewListsAffectedSessionsWithoutWritingAndPutRechecksWithoutPreview() throws Exception {
        linked(Session.SessionStatus.SCHEDULED, "2026-11-02T09:00", "2026-11-02T10:00", true);
        var body = request(); body.put("effectiveTo", "2026-10-31");
        preview(body).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(false))
                .andExpect(jsonPath("$.affectedSessionCount").value(1))
                .andExpect(jsonPath("$.affectedSessions.content[0].reasons[0]").isNotEmpty());
        assertThat(assignments.findById(id).orElseThrow().getEffectiveTo()).isEqualTo(LocalDate.of(2026,12,31));
        update(body).andExpect(status().isConflict());
        assertThat(assignments.findById(id).orElseThrow().getRevision()).isZero();
    }

    @Test
    void completedAndArchivedHistoryCannotBeMovedOutsideEffectivePeriod() throws Exception {
        linked(Session.SessionStatus.COMPLETED, "2026-01-10T09:00", "2026-01-10T10:00", false);
        var body = request(); body.put("effectiveFrom", "2026-02-01");
        preview(body).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(false));
        update(body).andExpect(status().isConflict());
    }

    @Test
    void cancelledSessionsAllowDateChangesButStillPreventTrainerChanges() throws Exception {
        linked(Session.SessionStatus.CANCELLED, "2026-11-02T09:00", "2026-11-02T10:00", false);
        var dates = request(); dates.put("effectiveTo", "2026-10-31");
        preview(dates).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(true));
        var trainer = request(); trainer.put("trainerId", 2);
        preview(trainer).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(false))
                .andExpect(jsonPath("$.affectedSessionCount").value(1));
        update(trainer).andExpect(status().isConflict());
        update(dates).andExpect(status().isOk());
        assertThat(sessions.findAssignmentSessions(id, null, org.springframework.data.domain.PageRequest.of(0,10)).getContent().get(0).getTrainerId()).isEqualTo(1L);
    }

    @Test
    void safeNarrowingIsAllowedAndUnlinkedLegacySessionsAreNotInferred() throws Exception {
        linked(Session.SessionStatus.SCHEDULED, "2026-11-02T09:00", "2026-11-02T10:00", true);
        var legacy = linked(Session.SessionStatus.SCHEDULED, "2026-12-02T09:00", "2026-12-02T10:00", true);
        legacy.setTeachingAssignmentId(null); sessions.saveAndFlush(legacy);
        var body = request(); body.put("effectiveTo", "2026-11-30");
        preview(body).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(true));
        update(body).andExpect(status().isOk());
    }

    @Test
    void staleAndMissingRevisionsCannotOverwriteAChangedAssignment() throws Exception {
        var first = request(); first.put("role", "ASSISTANT");
        update(first).andExpect(status().isOk());
        update(request()).andExpect(status().isConflict());
        preview(request()).andExpect(status().isConflict());
        var missing = request(); missing.remove("revision");
        update(missing).andExpect(status().isConflict());
    }

    @Test
    void saveDetectsNewSessionsAddedAfterASuccessfulPreview() throws Exception {
        var body = request(); body.put("effectiveTo", "2026-10-31");
        preview(body).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(true));
        linked(Session.SessionStatus.SCHEDULED, "2026-11-02T09:00", "2026-11-02T10:00", true);
        update(body).andExpect(status().isConflict());
    }

    @Test
    void impactUsesFullEndDateAndPaginatesAllAffectedRows() throws Exception {
        for (int index=0; index<12; index++) linked(Session.SessionStatus.SCHEDULED, "2026-11-02T23:00", "2026-11-03T00:00", true);
        var body=request(); body.put("effectiveTo", "2026-11-02");
        mvc.perform(post(path("/impact-preview")).header("Authorization", bearer).param("size", "10").param("page", "1")
                        .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.affectedSessionCount").value(12))
                .andExpect(jsonPath("$.affectedSessions.content", hasSize(2)));
    }

    @Test
    void permissionAndInvalidDateChecksApplyToPreviewAndSave() throws Exception {
        String student=login("student@example.com");
        mvc.perform(get(path("/edit-context")).header("Authorization",student)).andExpect(status().isForbidden());
        mvc.perform(post(path("/impact-preview")).header("Authorization",student).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(request()))).andExpect(status().isForbidden());
        mvc.perform(put(path("")).header("Authorization",student).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(request()))).andExpect(status().isForbidden());
        var body=request(); body.put("effectiveTo","2025-12-31");
        preview(body).andExpect(status().isBadRequest()); update(body).andExpect(status().isBadRequest());
    }

    @Test
    void localSessionWritesRejectStaleExternalAssignmentRangesAfterEdit() throws Exception {
        var body=request(); body.put("effectiveTo","2026-10-31"); update(body).andExpect(status().isOk());
        createSession().andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.teachingAssignmentId").isArray());
        assertThat(sessions.countByTeachingAssignmentId(id)).isZero();
        var validSession = new HashMap<>(sessionRequest());
        validSession.put("startTime", "2026-10-20T09:00:00"); validSession.put("endTime", "2026-10-20T10:00:00");
        mvc.perform(post("/api/sessions").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(validSession))).andExpect(status().isOk());
    }

    @Test
    void bulkWritesAlsoRespectTheCurrentLocalAssignmentRange() throws Exception {
        var body=request(); body.put("effectiveTo","2026-10-31"); update(body).andExpect(status().isOk());
        var item = new HashMap<>(sessionRequest()); item.put("tempId","test-row"); item.put("sessionNumber",1);
        mvc.perform(post("/api/classes/1/schedule-generation/save").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("sessions",List.of(item)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.issues[0].code").value("ASSIGNMENT_INVALID"));
        assertThat(sessions.countByTeachingAssignmentId(id)).isZero();
    }

    @Test
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void concurrentEditsFromSameRevisionCannotBothSucceed() throws Exception {
        try {
            var a=request(); a.put("effectiveTo","2026-11-30");
            var b=request(); b.put("effectiveTo","2026-10-31");
            assertThat(race(() -> update(a).andReturn().getResponse().getStatus(), () -> update(b).andReturn().getResponse().getStatus()))
                    .containsExactlyInAnyOrder(200,409);
        } finally { cleanupCommittedFixture(); }
    }

    @Test
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void concurrentSessionAndNarrowingCannotCommitAnInvalidCombination() throws Exception {
        try {
            var body=request(); body.put("effectiveTo","2026-10-31");
            List<Integer> result=race(() -> createSession().andReturn().getResponse().getStatus(), () -> update(body).andReturn().getResponse().getStatus());
            assertThat(result.equals(List.of(200,409)) || result.equals(List.of(400,200)))
                    .as("Session/update HTTP statuses: %s", result).isTrue();
            new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                var current=assignments.findById(id).orElseThrow();
                for (var session:sessions.findAssignmentSessions(id,null,org.springframework.data.domain.PageRequest.of(0,100))) {
                    assertThat(session.getEndTime().toLocalDate()).isBeforeOrEqualTo(current.getEffectiveTo());
                }
            });
        } finally { cleanupCommittedFixture(); }
    }

    private List<Integer> race(Callable<Integer> first,Callable<Integer> second) throws Exception {
        var ready=new CountDownLatch(2); var start=new CountDownLatch(1);
        try (var pool=Executors.newFixedThreadPool(2)) {
            List<Future<Integer>> futures=new ArrayList<>();
            for (var call:List.of(first,second)) futures.add(pool.submit(() -> {ready.countDown(); if(!start.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout"); return call.call();}));
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue(); start.countDown();
            return List.of(futures.get(0).get(20,TimeUnit.SECONDS),futures.get(1).get(20,TimeUnit.SECONDS));
        } finally {start.countDown();}
    }

    private void cleanupCommittedFixture() {
        sessions.deleteAll(sessions.findAssignmentSessions(id,null,org.springframework.data.domain.PageRequest.of(0,100)).getContent());
        assignments.deleteById(id);
    }
    private Map<String,Object> request() {
        return new HashMap<>(Map.of("classId",1,"programSubjectId",programSubjectId,"trainerId",1,"role","MAIN",
                "effectiveFrom","2026-01-01","effectiveTo","2026-12-31","revision",0));
    }
    private String path(String suffix) {return "/api/teaching-assignments/"+id+suffix;}
    private ResultActions preview(Map<String,Object> body) throws Exception {return mvc.perform(post(path("/impact-preview")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));}
    private ResultActions update(Map<String,Object> body) throws Exception {return mvc.perform(put(path("")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));}
    private Map<String,Object> sessionRequest() {return Map.of("classId",1,"topicId",subjectId,"trainerId",1,"teachingAssignmentId",id,"title","Linked session","startTime","2026-11-02T09:00:00","endTime","2026-11-02T10:00:00","meetingUrl","https://example.com/session","isActive",true);}
    private ResultActions createSession() throws Exception {return mvc.perform(post("/api/sessions").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(sessionRequest())));}
    private Session linked(Session.SessionStatus status,String from,String to,boolean active) {
        var s=new Session();s.setClassId(1L);s.setTopicId(subjectId);s.setTrainerId(1L);s.setTeachingAssignmentId(id);s.setTitle("Linked "+status);s.setStartTime(LocalDateTime.parse(from));s.setEndTime(LocalDateTime.parse(to));s.setStatus(status);s.setIsActive(active);return sessions.saveAndFlush(s);
    }
    private String login(String email) throws Exception {
        String response=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("email",email,"password","password123"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer "+mapper.readTree(response).get("accessToken").asText();
    }
}
