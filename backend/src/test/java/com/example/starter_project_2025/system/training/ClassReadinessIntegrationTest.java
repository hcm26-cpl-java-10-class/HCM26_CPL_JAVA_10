package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.trainingprogram.*;
import com.example.starter_project_2025.system.demo.session.*;
import com.example.starter_project_2025.system.external_api.*;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:class_readiness_tests;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@Transactional
class ClassReadinessIntegrationTest {
    @Autowired ClassReadinessService service;
    @Autowired TrainingClassRepository classes;
    @Autowired ClassEnrollmentRepository enrollments;
    @Autowired SessionRepository sessions;
    @Autowired TrainingProgramRepository programs;
    @Autowired ClassTrainingProgramRepository links;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired SubjectRepository subjects;
    @Autowired EntityManager em;
    @Autowired MockMvc mvc;
    @Autowired RefreshTokenService tokens;
    @Autowired UserDetailsService users;
    @MockBean ExternalApiService directory;
    TrainingClass item;

    @BeforeEach void setup() {
        item = new TrainingClass(); item.setCode("READY_TEST"); item.setName("Readiness test");
        item.setStatus("planning"); item.setStartDate(LocalDate.of(2030, 6, 1)); item.setEndDate(LocalDate.of(2030, 9, 1));
        item.setPlannedSize(2); item.setSite("HCM"); item.setProgram("READY_PROGRAM"); item.setMasterTrainer("Trainer");
        item.setDeliveryType("Class"); item.setFormatType("Offline"); item.setLocation("Room A"); classes.saveAndFlush(item);
        when(directory.fetchTrainers("active")).thenReturn(List.of(new ExternalTrainerDTO(900L, "Trainer", "trainer@example.test", "active")));
        when(directory.fetchRooms()).thenReturn(List.of(new ExternalRoomDTO(1L, "Room A", 20)));
    }

    private ClassReadinessService.Check check(String key) {
        return service.get(item.getId()).checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
    }
    private void enroll() {
        var e = new ClassEnrollment(); e.setTrainingClass(item); e.setTraineeId(901L); enrollments.saveAndFlush(e);
    }
    private void session() {
        var s = new Session(); s.setClassId(item.getId()); s.setTrainerId(900L); s.setTopicId(1L); s.setTitle("Readiness session");
        s.setStartTime(item.getStartDate().atTime(9, 0)); s.setEndTime(item.getStartDate().atTime(11, 0)); sessions.saveAndFlush(s);
    }
    private void linkProgramAndTrainer() {
        var p = new TrainingProgram(); p.setCode("READY_PROGRAM"); p.setName("Program"); p.setVersion("1"); p.setStatus(ProgramStatus.ACTIVE); programs.saveAndFlush(p);
        var link = new ClassTrainingProgram(); link.setClassId(item.getId()); link.setProgram(p); links.saveAndFlush(link);
        var ps = new ProgramSubject(); ps.setProgram(p); ps.setSubject(subjects.findAll().getFirst()); ps.setOrderIndex(1); em.persist(ps); em.flush();
        var a = new TeachingAssignment(); a.setClassId(item.getId()); a.setProgramSubject(ps); a.setTrainerId(900L);
        a.setRole(AssignmentRole.MAIN); a.setEffectiveFrom(item.getStartDate()); a.setEffectiveTo(item.getEndDate()); assignments.saveAndFlush(a);
    }

    @Test void missingEnrollmentAndSessionsAreNotReadyWithoutInventingData() {
        assertEquals(ClassReadinessService.State.NOT_READY, check("enrollment").status());
        assertEquals(ClassReadinessService.State.NOT_READY, check("calendar").status());
        assertEquals(ClassReadinessService.State.UNKNOWN, check("basic").status());
        assertEquals(ClassReadinessService.State.UNKNOWN, check("trainer").status());
        assertEquals("planning", classes.findById(item.getId()).orElseThrow().getStatus());
        assertEquals(0, enrollments.count()); assertEquals(0, sessions.count());
    }
    @Test void allChecksHaveRealEvidence() {
        enroll(); session(); linkProgramAndTrainer();
        var result = service.get(item.getId());
        assertEquals(5, result.ready()); assertEquals(5, result.verified()); assertEquals(0, result.unknown());
        assertEquals(1, result.enrolledTrainees());
    }
    @Test void unavailableOrSampleDirectoryIsUnknownRatherThanNotReady() {
        linkProgramAndTrainer();
        when(directory.fetchTrainers("active")).thenThrow(new ExternalApiException("Unavailable", 503, null));
        assertEquals(ClassReadinessService.State.UNKNOWN, check("trainer").status());
        when(directory.isSampleData()).thenReturn(true);
        assertEquals(ClassReadinessService.State.UNKNOWN, check("trainer").status());
    }
    @Test void enrollmentAndCalendarReflectNewRecordsWithoutChangingCapacity() {
        assertEquals(ClassReadinessService.State.NOT_READY, check("enrollment").status());
        enroll(); session();
        assertEquals(ClassReadinessService.State.READY, check("enrollment").status());
        assertEquals(ClassReadinessService.State.READY, check("calendar").status());
        assertEquals(2, item.getPlannedSize());
    }
    @Test void cancelledAndOutOfRangeSessionsDoNotMakeCalendarReady() {
        session(); var s = sessions.findByClassId(item.getId()).getFirst(); s.setStatus(Session.SessionStatus.CANCELLED); sessions.saveAndFlush(s);
        assertEquals(ClassReadinessService.State.NOT_READY, check("calendar").status());
        s.setStatus(Session.SessionStatus.SCHEDULED); s.setStartTime(item.getEndDate().plusDays(1).atTime(9, 0));
        s.setEndTime(item.getEndDate().plusDays(1).atTime(10, 0)); sessions.saveAndFlush(s);
        assertEquals(ClassReadinessService.State.NOT_READY, check("calendar").status());
    }
    @Test void onlineFormatRequiresValidMeetingUrlAndUnknownFormatIsUnknown() {
        item.setFormatType("Online"); classes.saveAndFlush(item);
        assertEquals(ClassReadinessService.State.NOT_READY, check("operations").status());
        item.setLocation("https://meet.example.test/class"); classes.saveAndFlush(item);
        assertEquals(ClassReadinessService.State.READY, check("operations").status());
        item.setFormatType("Custom"); classes.saveAndFlush(item);
        assertEquals(ClassReadinessService.State.UNKNOWN, check("operations").status());
    }
    @Test void unverifiedLocationIsUnknownAndUndersizedRoomIsNotReady() {
        when(directory.fetchRooms()).thenReturn(List.of());
        assertEquals(ClassReadinessService.State.UNKNOWN, check("operations").status());
        when(directory.fetchRooms()).thenReturn(List.of(new ExternalRoomDTO(1L, "Room A", 1)));
        assertEquals(ClassReadinessService.State.NOT_READY, check("operations").status());
    }
    @Test void endpointRequiresClassReadAndDoesNotExposeProfiles() throws Exception {
        mvc.perform(get("/api/classes/" + item.getId() + "/readiness")).andExpect(status().isUnauthorized());
        var student = users.loadUserByUsername("student@example.com");
        var token = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(student, null, student.getAuthorities()));
        mvc.perform(get("/api/classes/" + item.getId() + "/readiness").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        var admin = users.loadUserByUsername("admin@example.com");
        token = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
        mvc.perform(get("/api/classes/" + item.getId() + "/readiness").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.checks.length()").value(5)).andExpect(jsonPath("$.unknown").value(2))
            .andExpect(jsonPath("$.trainees").doesNotExist());
    }
}
