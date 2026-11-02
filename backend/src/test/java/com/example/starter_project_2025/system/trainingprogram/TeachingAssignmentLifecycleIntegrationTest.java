package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.schedule.ScheduleReferenceProvider;
import com.example.starter_project_2025.system.schedule.ScheduleReferences;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class TeachingAssignmentLifecycleIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ClassTrainingProgramRepository classPrograms;
    @Autowired SessionRepository sessions;
    @Autowired PlatformTransactionManager transactions;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @SpyBean ExternalApiService external;
    @MockBean ScheduleReferenceProvider references;
    private String bearer;
    private Long id;
    private Long subjectId;

    @BeforeEach
    void setUp() throws Exception {
        bearer=login("admin@example.com");
        new TransactionTemplate(transactions).executeWithoutResult(tx->{
            var ps=classPrograms.findByClassId(1L).orElseThrow().getProgram().getSubjects().get(0);
            subjectId=ps.getSubject().getId();
            var a=new TeachingAssignment(); a.setClassId(1L); a.setProgramSubject(ps); a.setTrainerId(1L); a.setRole(AssignmentRole.MAIN);
            a.setEffectiveFrom(LocalDate.of(2026,1,1)); a.setEffectiveTo(LocalDate.of(2026,12,31)); id=assignments.saveAndFlush(a).getId();
        });
        var clazz=external.fetchClassById(1L); clazz.setStartDate("2026-01-01"); clazz.setEndDate("2026-12-31");
        doReturn(new ScheduleReferences(List.of(clazz),external.fetchTrainers("active"),List.of(),
                List.of(new ScheduleReferences.Assignment(id,1L,subjectId,1L,LocalDate.of(2026,1,1),LocalDate.of(2026,12,31),"ACTIVE")),List.of()))
                .when(references).load();
    }

    @Test
    void deletesOnlyAnUnusedAssignmentAndLeavesOtherSessionsUntouched() throws Exception {
        var legacy=linked(Session.SessionStatus.CANCELLED,true,"2026-11-02T09:00","2026-11-02T10:00");
        legacy.setTeachingAssignmentId(null); sessions.saveAndFlush(legacy);
        context().andExpect(status().isOk()).andExpect(jsonPath("$.canDelete").value(true)).andExpect(jsonPath("$.assignment.revision").value(0));
        deleteCurrent(0).andExpect(status().isNoContent());
        assertThat(assignments.existsById(id)).isFalse(); assertThat(sessions.existsById(legacy.getId())).isTrue();
    }

    @ParameterizedTest
    @CsvSource({"SCHEDULED,true","COMPLETED,true","CANCELLED,true","COMPLETED,false","CANCELLED,false"})
    void anyReferencedSessionBlocksDeletion(Session.SessionStatus status,boolean active) throws Exception {
        var session=linked(status,active,"2026-11-02T09:00","2026-11-02T10:00");
        context().andExpect(status().isOk()).andExpect(jsonPath("$.canDelete").value(false)).andExpect(jsonPath("$.linkedSessionCount").value(1));
        deleteCurrent(0).andExpect(status().isConflict());
        assertThat(assignments.existsById(id)).isTrue(); assertThat(sessions.existsById(session.getId())).isTrue();
    }

    @Test
    void endsSafelyWithInclusiveDateAndKeepsCancelledHistory() throws Exception {
        linked(Session.SessionStatus.SCHEDULED,true,"2026-10-31T09:00","2026-10-31T10:00");
        linked(Session.SessionStatus.CANCELLED,false,"2026-11-02T09:00","2026-11-02T10:00");
        preview("2026-10-31",0).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(true));
        end("2026-10-31",0).andExpect(status().isOk()).andExpect(jsonPath("$.effectiveTo").value("2026-10-31"))
                .andExpect(jsonPath("$.revision").value(1));
        assertThat(sessions.countByTeachingAssignmentId(id)).isEqualTo(2);
        mvc.perform(get("/api/classes/1/teaching-assignments/available").param("date","2026-10-31").header("Authorization",bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/classes/1/teaching-assignments/available").param("date","2026-11-01").header("Authorization",bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void openEndedAssignmentCanBeEndedWithoutChangingItsStartOrTrainer() throws Exception {
        var a=assignments.findById(id).orElseThrow(); a.setEffectiveTo(null); assignments.saveAndFlush(a);
        end("2026-10-31",a.getRevision()).andExpect(status().isOk()).andExpect(jsonPath("$.effectiveFrom").value("2026-01-01"))
                .andExpect(jsonPath("$.trainerId").value(1));
    }

    @Test
    void futureAndCompletedSessionsBlockEarlyEndingAndPreviewDoesNotWrite() throws Exception {
        linked(Session.SessionStatus.COMPLETED,false,"2026-11-02T09:00","2026-11-02T10:00");
        preview("2026-10-31",0).andExpect(status().isOk()).andExpect(jsonPath("$.affectedSessionCount").value(1))
                .andExpect(jsonPath("$.affectedSessions.content[0].reasons[0]").isNotEmpty());
        end("2026-10-31",0).andExpect(status().isConflict());
        assertThat(assignments.findById(id).orElseThrow().getEffectiveTo()).isEqualTo(LocalDate.of(2026,12,31));
        assertThat(assignments.findById(id).orElseThrow().getRevision()).isZero();
    }

    @Test
    void lifecycleRejectsExtensionReversedDatesAndMalformedInput() throws Exception {
        for(String date:List.of("2025-12-31","2027-01-01")) {
            preview(date,0).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.effectiveTo").isArray());
            end(date,0).andExpect(status().isBadRequest());
        }
        mvc.perform(patch(path("/end")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content("{\"revision\":0}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.effectiveTo").isArray());
        mvc.perform(patch(path("/end")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content("{\"effectiveTo\":\"2026-10-31\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.revision").isArray());
        mvc.perform(patch(path("/end")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content("{\"effectiveTo\":\"bad-date\",\"revision\":0}"))
                .andExpect(status().isBadRequest());
        mvc.perform(delete(path("")).param("revision","bad").header("Authorization",bearer)).andExpect(status().isBadRequest());
        mvc.perform(delete(path("")).header("Authorization",bearer)).andExpect(status().isConflict());
    }

    @Test
    void staleRevisionCannotEndOrDeleteANewerAssignment() throws Exception {
        end("2026-11-30",0).andExpect(status().isOk());
        end("2026-10-31",0).andExpect(status().isConflict()); preview("2026-10-31",0).andExpect(status().isConflict());
        deleteCurrent(0).andExpect(status().isConflict());
        deleteCurrent(1).andExpect(status().isNoContent());
    }

    @Test
    void newReferenceAfterDeleteContextOrEndPreviewIsRechecked() throws Exception {
        context().andExpect(status().isOk()).andExpect(jsonPath("$.canDelete").value(true));
        preview("2026-10-31",0).andExpect(status().isOk()).andExpect(jsonPath("$.canSave").value(true));
        linked(Session.SessionStatus.SCHEDULED,true,"2026-11-02T09:00","2026-11-02T10:00");
        deleteCurrent(0).andExpect(status().isConflict()); end("2026-10-31",0).andExpect(status().isConflict());
    }

    @Test
    void endAndDeleteRemainAvailableWhenSharedProfilesAreUnavailable() throws Exception {
        doThrow(new ExternalApiException("Shared profiles unavailable",503,null)).when(external).fetchClassById(anyLong());
        doThrow(new ExternalApiException("Shared profiles unavailable",503,null)).when(external).fetchTrainers(null);
        context().andExpect(status().isOk()); preview("2026-10-31",0).andExpect(status().isOk());
        end("2026-10-31",0).andExpect(status().isOk()); deleteCurrent(1).andExpect(status().isNoContent());
    }

    @Test
    void deleteOnlyPermissionDoesNotGrantEndPermission() throws Exception {
        String onlyDelete=loginWithPermission("ASSIGNMENT_DELETE");
        mvc.perform(get(path("/lifecycle-context")).header("Authorization",onlyDelete)).andExpect(status().isOk());
        mvc.perform(patch(path("/end")).header("Authorization",onlyDelete).contentType(MediaType.APPLICATION_JSON).content(endBody("2026-10-31",0)))
                .andExpect(status().isForbidden());
        mvc.perform(post(path("/end-preview")).header("Authorization",onlyDelete).contentType(MediaType.APPLICATION_JSON).content(endBody("2026-10-31",0)))
                .andExpect(status().isForbidden());
        mvc.perform(delete(path("")).param("revision","0").header("Authorization",onlyDelete)).andExpect(status().isNoContent());
    }

    @Test
    void updateOnlyPermissionDoesNotGrantDeletePermission() throws Exception {
        String onlyUpdate=loginWithPermission("ASSIGNMENT_UPDATE");
        mvc.perform(get(path("/lifecycle-context")).header("Authorization",onlyUpdate)).andExpect(status().isOk());
        mvc.perform(delete(path("")).param("revision","0").header("Authorization",onlyUpdate)).andExpect(status().isForbidden());
        mvc.perform(patch(path("/end")).header("Authorization",onlyUpdate).contentType(MediaType.APPLICATION_JSON).content(endBody("2026-10-31",0)))
                .andExpect(status().isOk());
    }

    @Test
    void missingAssignmentHasNoLifecycleActions() throws Exception {
        String missing="/api/teaching-assignments/999999";
        mvc.perform(get(missing+"/lifecycle-context").header("Authorization",bearer)).andExpect(status().isNotFound());
        mvc.perform(post(missing+"/end-preview").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(endBody("2026-10-31",0))).andExpect(status().isNotFound());
        mvc.perform(patch(missing+"/end").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(endBody("2026-10-31",0))).andExpect(status().isNotFound());
        mvc.perform(delete(missing).param("revision","0").header("Authorization",bearer)).andExpect(status().isNotFound());
    }

    @Test
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void usageRemainsRecordedAfterTheLastSessionIsDeleted() throws Exception {
        try {
            String created=createSession().andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            long sessionId=mapper.readTree(created).get("id").asLong();
            mvc.perform(delete("/api/sessions/{id}",sessionId).header("Authorization",bearer)).andExpect(status().isNoContent());
            context().andExpect(status().isOk()).andExpect(jsonPath("$.linkedSessionCount").value(0))
                    .andExpect(jsonPath("$.previouslyUsed").value(true)).andExpect(jsonPath("$.canDelete").value(false));
            long revision=assignments.findById(id).orElseThrow().getRevision();
            deleteCurrent(revision).andExpect(status().isConflict());
            mvc.perform(get(path("/edit-context")).header("Authorization",bearer)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.trainerLocked").value(true));
            end("2026-10-31",revision).andExpect(status().isOk());
        } finally {cleanupCommittedFixture();}
    }

    @Test
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void rejectedSessionDoesNotPermanentlyMarkAnAssignmentAsUsed() throws Exception {
        try {
            var bad=new HashMap<String,Object>(Map.of("classId",1,"topicId",subjectId,"trainerId",1,"teachingAssignmentId",id,
                    "title","Invalid venue","startTime","2026-11-02T09:00:00","endTime","2026-11-02T10:00:00","meetingUrl","invalid","isActive",true));
            mvc.perform(post("/api/sessions").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(bad))).andExpect(status().isConflict());
            var assignment=assignments.findById(id).orElseThrow();
            assertThat(assignment.getEverUsed()).isFalse(); assertThat(assignment.getRevision()).isZero();
            deleteCurrent(0).andExpect(status().isNoContent());
        } finally {cleanupCommittedFixture();}
    }

    @Test
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void deleteRacingWithSessionCreationCannotLeaveAnOrphan() throws Exception {
        try {
            var result=race(()->createSession().andReturn().getResponse().getStatus(),()->deleteCurrent(0).andReturn().getResponse().getStatus());
            assertThat(result.equals(List.of(200,409)) || result.equals(List.of(400,204))).as("Session/delete statuses: %s",result).isTrue();
            if(!assignments.existsById(id)) assertThat(sessions.countByTeachingAssignmentId(id)).isZero();
        } finally {cleanupCommittedFixture();}
    }

    @Test
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void endingRacingWithSessionCreationPreservesTheEffectivePeriod() throws Exception {
        try {
            var result=race(()->createSession().andReturn().getResponse().getStatus(),()->end("2026-10-31",0).andReturn().getResponse().getStatus());
            assertThat(result.equals(List.of(200,409)) || result.equals(List.of(400,200))).as("Session/end statuses: %s",result).isTrue();
            new TransactionTemplate(transactions).executeWithoutResult(tx->{
                var a=assignments.findById(id).orElseThrow();
                for(var s:sessions.findAssignmentSessions(id,null,org.springframework.data.domain.PageRequest.of(0,100))) assertThat(s.getEndTime().toLocalDate()).isBeforeOrEqualTo(a.getEffectiveTo());
            });
        } finally {cleanupCommittedFixture();}
    }

    private List<Integer> race(Callable<Integer> first,Callable<Integer> second) throws Exception {
        var ready=new CountDownLatch(2); var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Future<Integer>> futures=new ArrayList<>();
            for(var call:List.of(first,second)) futures.add(pool.submit(()->{ready.countDown();if(!start.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");return call.call();}));
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();
            return List.of(futures.get(0).get(20,TimeUnit.SECONDS),futures.get(1).get(20,TimeUnit.SECONDS));
        } finally {start.countDown();}
    }
    private void cleanupCommittedFixture() {sessions.deleteAll(sessions.findAssignmentSessions(id,null,org.springframework.data.domain.PageRequest.of(0,100)).getContent());if(assignments.existsById(id)) assignments.deleteById(id);}
    private String path(String suffix) {return "/api/teaching-assignments/"+id+suffix;}
    private ResultActions context() throws Exception {return mvc.perform(get(path("/lifecycle-context")).header("Authorization",bearer));}
    private ResultActions preview(String date,long revision) throws Exception {return mvc.perform(post(path("/end-preview")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(endBody(date,revision)));}
    private ResultActions end(String date,long revision) throws Exception {return mvc.perform(patch(path("/end")).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(endBody(date,revision)));}
    private ResultActions deleteCurrent(long revision) throws Exception {return mvc.perform(delete(path("")).param("revision",String.valueOf(revision)).header("Authorization",bearer));}
    private String endBody(String date,long revision) throws Exception {return mapper.writeValueAsString(Map.of("effectiveTo",date,"revision",revision));}
    private ResultActions createSession() throws Exception {return mvc.perform(post("/api/sessions").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("classId",1,"topicId",subjectId,"trainerId",1,"teachingAssignmentId",id,"title","Lifecycle race","startTime","2026-11-02T09:00:00","endTime","2026-11-02T10:00:00","meetingUrl","https://example.com/session","isActive",true))));}
    private Session linked(Session.SessionStatus status,boolean active,String from,String until) {var s=new Session();s.setClassId(1L);s.setTopicId(subjectId);s.setTrainerId(1L);s.setTeachingAssignmentId(id);s.setTitle("Linked "+status);s.setStartTime(LocalDateTime.parse(from));s.setEndTime(LocalDateTime.parse(until));s.setStatus(status);s.setIsActive(active);return sessions.saveAndFlush(s);}
    private String loginWithPermission(String permission) throws Exception {var role=new Role();role.setName("LIFECYCLE_"+permission);role.setPermissions(new HashSet<>(Set.of(permissions.findByName(permission).orElseThrow())));roles.saveAndFlush(role);var user=users.findByEmail("teacher@example.com").orElseThrow();user.setRoles(new HashSet<>(Set.of(role)));users.saveAndFlush(user);return login("teacher@example.com");}
    private String login(String email) throws Exception {String response=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("email",email,"password","password123")))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();return "Bearer "+mapper.readTree(response).get("accessToken").asText();}
}
