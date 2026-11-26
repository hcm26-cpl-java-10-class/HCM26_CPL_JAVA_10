package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionDTO;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.external_api.LocalExternalApiService;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.training.ClassEnrollment;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import com.example.starter_project_2025.system.training.TrainingClassRepository;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = "app.seed.team-allocation.enabled=false")
@Transactional
class CalendarControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private LocalExternalApiService localExternalApiService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private TrainingClassRepository trainingClassRepository;

    @Autowired
    private ClassEnrollmentRepository classEnrollmentRepository;

    private String adminToken;

    @BeforeEach
    void setUp() {
        UserDetails admin = userDetailsService.loadUserByUsername("admin@example.com");
        adminToken = refreshTokenService.generateAccessToken(
                new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
    }

    @Test
    void getCalendarSessions_filtersAndValidatesDateRange() throws Exception {
        mockMvc.perform(get("/api/calendar/sessions")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("from", "2026-10-01T00:00:00")
                        .param("to", "2026-10-05T23:59:59")
                        .param("classId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());

        mockMvc.perform(get("/api/calendar/sessions")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("from", "2026-10-10T00:00:00")
                        .param("to", "2026-10-01T00:00:00"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createBatchAndDeleteByClassId_validateConflictsAtomically() throws Exception {
        long testClassId = 999L;

        List<SessionDTO> validBatch = List.of(
                SessionDTO.builder()
                        .classId(testClassId).topicId(1L).trainerId(1L)
                        .title("[JAVA_CORE] Batch 1")
                        .startTime(LocalDateTime.of(2028, 6, 1, 8, 0))
                        .endTime(LocalDateTime.of(2028, 6, 1, 12, 0))
                        .location("Lab 201").build(),
                SessionDTO.builder()
                        .classId(testClassId).topicId(1L).trainerId(1L)
                        .title("[JAVA_CORE] Batch 2")
                        .startTime(LocalDateTime.of(2028, 6, 1, 13, 0))
                        .endTime(LocalDateTime.of(2028, 6, 1, 17, 0))
                        .location("Lab 201").build()
        );

        mockMvc.perform(post("/api/sessions/batch")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBatch)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        assertEquals(2, sessionRepository.findByClassId(testClassId).size());

        List<SessionDTO> conflictingBatch = List.of(
                SessionDTO.builder()
                        .classId(testClassId).topicId(1L).trainerId(1L)
                        .title("[JAVA_CORE] Overlap 1")
                        .startTime(LocalDateTime.of(2028, 6, 2, 8, 0))
                        .endTime(LocalDateTime.of(2028, 6, 2, 12, 0))
                        .location("Lab 201").build(),
                SessionDTO.builder()
                        .classId(testClassId).topicId(1L).trainerId(1L)
                        .title("[JAVA_CORE] Overlap 2")
                        .startTime(LocalDateTime.of(2028, 6, 2, 10, 0))
                        .endTime(LocalDateTime.of(2028, 6, 2, 13, 0))
                        .location("Lab 201").build()
        );

        mockMvc.perform(post("/api/sessions/batch")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(conflictingBatch)))
                .andExpect(status().isConflict());

        // Atomic rollback ensures Overlap 1 was not persisted either
        assertEquals(2, sessionRepository.findByClassId(testClassId).size());

        mockMvc.perform(delete("/api/sessions/class/" + testClassId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        assertEquals(0, sessionRepository.findByClassId(testClassId).size());
    }

    @Test
    void mySessions_localProfile_trainerOneSeesOwnSessionsWithoutInheritingNoteOnlyOrUnverifiedSessionsAndTraineeSeesEnrolledClass() throws Exception {
        TrainingClass enrolledClass = new TrainingClass();
        enrolledClass.setCode("LOC_SCOPE_01");
        enrolledClass.setName("Local Scope Test Class");
        enrolledClass.setStatus("active");
        enrolledClass.setStartDate(LocalDate.of(2028, 7, 1));
        enrolledClass.setEndDate(LocalDate.of(2028, 9, 1));
        enrolledClass.setPlannedSize(25);
        enrolledClass = trainingClassRepository.saveAndFlush(enrolledClass);

        // 1. Verified session genuinely belonging to Trainer #1 (Nguyễn Ngọc Tân, trainer.tan@example.com)
        sessionRepository.saveAndFlush(Session.builder()
                .classId(enrolledClass.getId()).topicId(1L).trainerId(1L)
                .title("[JAVA_CORE] Verified Trainer 1 Session")
                .startTime(LocalDateTime.of(2028, 7, 10, 8, 0))
                .endTime(LocalDateTime.of(2028, 7, 10, 10, 0))
                .location("Lab 201").status(Session.SessionStatus.SCHEDULED).build());

        // 2. New local session created with an unverified trainer name -> must store UNVERIFIED_TRAINER_ID (0L), not 1L
        localExternalApiService.createClassSession(enrolledClass.getId(), Map.of(
                "topic", "[JAVA_CORE] New Unverified Local Session",
                "trainer", "External Guest Lecturer",
                "room", "Lab 202",
                "date", "2028-07-10",
                "slot", "13:00 - 15:00"
        ));

        // 3. Legacy local session that defaulted to trainerId = 1L while only storing a trainer name in note
        sessionRepository.saveAndFlush(Session.builder()
                .classId(enrolledClass.getId()).topicId(1L).trainerId(1L)
                .title("[JAVA_CORE] Legacy Note-Only Trainer Session")
                .note("Trainer: Nguyễn Ngọc Tân (Trainer)")
                .startTime(LocalDateTime.of(2028, 7, 11, 8, 0))
                .endTime(LocalDateTime.of(2028, 7, 11, 10, 0))
                .location("Lab 203").status(Session.SessionStatus.SCHEDULED).build());

        // Verify the newly created unverified local session was NOT assigned trainerId = 1L
        Session createdUnverified = sessionRepository.findByClassId(enrolledClass.getId()).stream()
                .filter(s -> "[JAVA_CORE] New Unverified Local Session".equals(s.getTitle()))
                .findFirst().orElseThrow();
        assertEquals(LocalExternalApiService.UNVERIFIED_TRAINER_ID, createdUnverified.getTrainerId());

        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();

        User trainerOneUser = new User();
        trainerOneUser.setEmail("trainer.tan@example.com");
        trainerOneUser.setFirstName("Tan");
        trainerOneUser.setLastName("Trainer");
        trainerOneUser.setPasswordHash("{noop}password");
        trainerOneUser.setIsActive(true);
        trainerOneUser.setRoles(Set.of(studentRole));
        userRepository.saveAndFlush(trainerOneUser);

        UserDetails trainerDetails = userDetailsService.loadUserByUsername("trainer.tan@example.com");
        String trainerToken = refreshTokenService.generateAccessToken(
                new UsernamePasswordAuthenticationToken(trainerDetails, null, trainerDetails.getAuthorities()));

        // Trainer #1 sees ONLY their verified session — neither the new unverified session nor the legacy note-only session
        mockMvc.perform(get("/api/calendar/my-sessions")
                        .header("Authorization", "Bearer " + trainerToken)
                        .param("from", "2028-07-01T00:00:00")
                        .param("to", "2028-07-31T00:00:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].title").value("[JAVA_CORE] Verified Trainer 1 Session"));

        // Trainee with active enrollment in the class STILL sees all 3 sessions of the class
        User traineeUser = new User();
        traineeUser.setEmail("enrolled.trainee@example.com");
        traineeUser.setFirstName("Enrolled");
        traineeUser.setLastName("Trainee");
        traineeUser.setPasswordHash("{noop}password");
        traineeUser.setIsActive(true);
        traineeUser.setRoles(Set.of(studentRole));
        userRepository.saveAndFlush(traineeUser);

        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setTrainingClass(enrolledClass);
        enrollment.setTraineeId(7777L);
        enrollment.setFullName("Enrolled Trainee");
        enrollment.setPersonalEmail("enrolled.trainee@example.com");
        enrollment.setStatus(ClassEnrollment.Status.ACTIVE);
        enrollment.setIsActive(true);
        classEnrollmentRepository.saveAndFlush(enrollment);

        UserDetails traineeDetails = userDetailsService.loadUserByUsername("enrolled.trainee@example.com");
        String traineeToken = refreshTokenService.generateAccessToken(
                new UsernamePasswordAuthenticationToken(traineeDetails, null, traineeDetails.getAuthorities()));

        mockMvc.perform(get("/api/calendar/my-sessions")
                        .header("Authorization", "Bearer " + traineeToken)
                        .param("from", "2028-07-01T00:00:00")
                        .param("to", "2028-07-31T00:00:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(3)));
    }
}

