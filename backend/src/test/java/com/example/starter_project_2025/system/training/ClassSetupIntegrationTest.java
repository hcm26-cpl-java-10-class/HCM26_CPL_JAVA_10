package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.trainingprogram.*;
import com.example.starter_project_2025.system.subject.*;
import com.example.starter_project_2025.system.external_api.*;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.role.*;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:class_setup_tests;DB_CLOSE_DELAY=-1", "GOOGLE_CLIENT_ID=test", "GOOGLE_CLIENT_SECRET=test"})
@AutoConfigureMockMvc
@Transactional
class ClassSetupIntegrationTest {
    @Autowired ClassSetupService setup;
    @Autowired ClassReadinessService readiness;
    @Autowired TrainingClassRepository classes;
    @Autowired TrainingProgramRepository programs;
    @Autowired ClassTrainingProgramRepository links;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired SubjectRepository subjects;
    @Autowired EntityManager em;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired RefreshTokenService tokens;
    @Autowired UserDetailsService users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired UserRepository accounts;
    @MockBean ExternalApiService directory;
    TrainingClass cls;
    TrainingProgram program;
    ProgramSubject subject;
    String admin;

    @BeforeEach void fixture() {
        cls = addClass("SETUP_TEST");
        program = addProgram("SETUP_PROGRAM");
        subject = addSubject(program);
        when(directory.fetchTrainers("active")).thenReturn(List.of(new ExternalTrainerDTO(9100L, "Verified Trainer", "trainer@example.test", "active")));
        admin = token("admin@example.com");
    }
    private TrainingClass addClass(String code) {
        var c = new TrainingClass(); c.setCode(code); c.setName(code); c.setProgram("SETUP_PROGRAM"); c.setSite("HCM");
        c.setClassAdmin("Admin"); c.setMasterTrainer("Verified Trainer"); c.setStatus("planning"); c.setPlannedSize(20);
        c.setStartDate(LocalDate.of(2030, 6, 1)); c.setEndDate(LocalDate.of(2030, 9, 1));
        c.setDeliveryType("Class"); c.setFormatType("Online"); c.setLocation("https://meeting.example.test/class");
        return classes.saveAndFlush(c);
    }
    private TrainingProgram addProgram(String code) {
        var p = new TrainingProgram(); p.setCode(code); p.setName(code + " name"); p.setVersion("1.0"); p.setStatus(ProgramStatus.ACTIVE);
        return programs.saveAndFlush(p);
    }
    private ProgramSubject addSubject(TrainingProgram p) {
        var ps = new ProgramSubject(); ps.setProgram(p); ps.setSubject(subjects.findAll().stream().filter(s -> Boolean.TRUE.equals(s.getIsActive())).findFirst().orElseThrow());
        ps.setOrderIndex(1); em.persist(ps); em.flush(); return ps;
    }
    private TeachingAssignmentRequest input() {
        return new TeachingAssignmentRequest(cls.getId(), subject.getId(), 9100L, AssignmentRole.MAIN, cls.getStartDate(), cls.getEndDate());
    }
    private String path() { return "/api/classes/" + cls.getId(); }
    private String token(String email) {
        var user = users.loadUserByUsername(email);
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }
    private String limited(String name, String... allowed) {
        var role = new Role(); role.setName(name); role.setDescription("Test permissions");
        role.setPermissions(new HashSet<>(Arrays.stream(allowed).map(n -> permissions.findByName(n).orElseThrow()).toList()));
        roles.saveAndFlush(role);
        var user = new com.example.starter_project_2025.system.rbac.user.User();
        user.setEmail(name + "@example.test"); user.setFirstName(name); user.setLastName("Test"); user.setPasswordHash("unused-test-hash"); user.setRoles(new HashSet<>(Set.of(role)));
        accounts.saveAndFlush(user); return token(user.getEmail());
    }

    @Test void programLinkIsInternalIdempotentAndReadinessReadsSavedData() throws Exception {
        var other = addClass("OTHER_SETUP");
        mvc.perform(put(path() + "/program-link").header("Authorization", "Bearer " + admin).contentType("application/json")
            .content("{\"programId\":" + program.getId() + "}")).andExpect(status().isOk()).andExpect(jsonPath("$.programId").value(program.getId()));
        long linkId = links.findByClassId(cls.getId()).orElseThrow().getId();
        setup.link(cls.getId(), program.getId());
        assertEquals(linkId, links.findByClassId(cls.getId()).orElseThrow().getId());
        assertTrue(links.findByClassId(other.getId()).isEmpty());
        assertEquals("SETUP_PROGRAM", classes.findById(other.getId()).orElseThrow().getProgram());
        mvc.perform(get(path() + "/readiness").header("Authorization", "Bearer " + admin))
            .andExpect(status().isOk()).andExpect(jsonPath("$.checks[0].status").value("READY"));
        verify(directory, never()).fetchClassById(any()); verify(directory, never()).fetchClasses(any());
    }
    @Test void unknownInternalIdNeverFallsBackToSharedClass() throws Exception {
        mvc.perform(put("/api/classes/999999/program-link").header("Authorization", "Bearer " + admin).contentType("application/json")
            .content("{\"programId\":" + program.getId() + "}")).andExpect(status().isNotFound());
        verifyNoInteractions(directory);
    }
    @Test void programMismatchIsReportedWithoutChangingClassInfo() {
        cls.setProgram("FR_NFP_DOTNET"); classes.saveAndFlush(cls);
        assertThrows(ConflictException.class, () -> setup.link(cls.getId(), program.getId()));
        assertEquals("FR_NFP_DOTNET", classes.findById(cls.getId()).orElseThrow().getProgram());
        assertTrue(links.findByClassId(cls.getId()).isEmpty());
    }
    @Test void inactiveOrDeletedProgramsCannotBeLinked() {
        program.setStatus(ProgramStatus.INACTIVE); programs.saveAndFlush(program);
        assertThrows(BadRequestException.class, () -> setup.link(cls.getId(), program.getId()));
        program.setStatus(ProgramStatus.ACTIVE); program.setIsActive(false); programs.saveAndFlush(program);
        assertThrows(BadRequestException.class, () -> setup.link(cls.getId(), program.getId()));
        assertTrue(links.findByClassId(cls.getId()).isEmpty());
    }
    @Test void programWithoutEligibleSubjectsCannotBeLinked() {
        var empty = addProgram("EMPTY_PROGRAM"); cls.setProgram(empty.getCode()); classes.saveAndFlush(cls);
        assertThrows(BadRequestException.class, () -> setup.link(cls.getId(), empty.getId()));
    }
    @Test void createAndUpdateMainAssignmentArePersistedAndBecomeReadinessEvidence() throws Exception {
        setup.link(cls.getId(), program.getId());
        var response = mvc.perform(post(path() + "/teaching-assignments").header("Authorization", "Bearer " + admin)
            .contentType("application/json").content(mapper.writeValueAsString(input())))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.classId").value(cls.getId())).andReturn();
        long id = mapper.readTree(response.getResponse().getContentAsString()).path("id").asLong();
        var changed = new TeachingAssignmentRequest(cls.getId(), subject.getId(), 9100L, AssignmentRole.MAIN, cls.getStartDate().minusDays(2), null);
        mvc.perform(put(path() + "/teaching-assignments/" + id).header("Authorization", "Bearer " + admin)
            .contentType("application/json").content(mapper.writeValueAsString(changed))).andExpect(status().isOk());
        em.clear();
        assertEquals(1, assignments.findByClassIdOrderByEffectiveFromAscIdAsc(cls.getId()).size());
        assertNull(assignments.findById(id).orElseThrow().getEffectiveTo());
        mvc.perform(get(path() + "/setup").header("Authorization", "Bearer " + admin)).andExpect(status().isOk())
            .andExpect(jsonPath("$.assignments[0].id").value(id)).andExpect(jsonPath("$.subjects[0].eligible").value(true));
        mvc.perform(get(path() + "/readiness").header("Authorization", "Bearer " + admin)).andExpect(status().isOk())
            .andExpect(jsonPath("$.checks[1].status").value("READY"));
    }
    @Test void assignmentMustReferenceTheLinkedProgramSubjectAndInternalClass() {
        setup.link(cls.getId(), program.getId());
        var foreign = addSubject(addProgram("FOREIGN_PROGRAM"));
        assertThrows(BadRequestException.class, () -> setup.saveAssignment(cls.getId(), null,
            new TeachingAssignmentRequest(cls.getId(), foreign.getId(), 9100L, AssignmentRole.MAIN, cls.getStartDate(), null)));
        assertThrows(BadRequestException.class, () -> setup.saveAssignment(cls.getId(), null,
            new TeachingAssignmentRequest(cls.getId() + 1000, subject.getId(), 9100L, AssignmentRole.MAIN, cls.getStartDate(), null)));
        assertTrue(assignments.findByClassIdOrderByEffectiveFromAscIdAsc(cls.getId()).isEmpty());
    }
    @Test void mainDatesMustCoverWholeClassAndRoleMustBeMain() {
        setup.link(cls.getId(), program.getId());
        for (var request : List.of(
            new TeachingAssignmentRequest(cls.getId(), subject.getId(), 9100L, AssignmentRole.MAIN, cls.getStartDate().plusDays(1), null),
            new TeachingAssignmentRequest(cls.getId(), subject.getId(), 9100L, AssignmentRole.MAIN, cls.getStartDate(), cls.getEndDate().minusDays(1)),
            new TeachingAssignmentRequest(cls.getId(), subject.getId(), 9100L, AssignmentRole.ASSISTANT, cls.getStartDate(), null)))
            assertThrows(BadRequestException.class, () -> setup.saveAssignment(cls.getId(), null, request));
        assertTrue(assignments.findByClassIdOrderByEffectiveFromAscIdAsc(cls.getId()).isEmpty());
    }
    @Test void duplicatesAndOverlappingMainAssignmentsAreRejected() {
        setup.link(cls.getId(), program.getId()); setup.saveAssignment(cls.getId(), null, input());
        assertThrows(ConflictException.class, () -> setup.saveAssignment(cls.getId(), null, input()));
        assertThrows(ConflictException.class, () -> setup.saveAssignment(cls.getId(), null,
            new TeachingAssignmentRequest(cls.getId(), subject.getId(), 999L, AssignmentRole.MAIN, cls.getStartDate(), null)));
        assertEquals(1, assignments.findByClassIdOrderByEffectiveFromAscIdAsc(cls.getId()).size());
    }
    @Test void crossClassAssignmentUpdateDoesNotModifyEitherClass() {
        setup.link(cls.getId(), program.getId()); var saved = setup.saveAssignment(cls.getId(), null, input());
        var other = addClass("OTHER_CLASS");
        assertThrows(ResourceNotFoundException.class, () -> setup.saveAssignment(other.getId(), saved.id(),
            new TeachingAssignmentRequest(other.getId(), subject.getId(), 9100L, AssignmentRole.MAIN, other.getStartDate(), null)));
        assertEquals(cls.getId(), assignments.findById(saved.id()).orElseThrow().getClassId());
        assertTrue(assignments.findByClassIdOrderByEffectiveFromAscIdAsc(other.getId()).isEmpty());
    }
    @Test void sampleAndUnreachableTrainerApiAreBlockedWithoutSaving() throws Exception {
        setup.link(cls.getId(), program.getId()); when(directory.isSampleData()).thenReturn(true);
        mvc.perform(post(path() + "/teaching-assignments").header("Authorization", "Bearer " + admin)
            .contentType("application/json").content(mapper.writeValueAsString(input())))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("BLOCKED")));
        when(directory.isSampleData()).thenReturn(false);
        when(directory.fetchTrainers("active")).thenThrow(new ExternalApiException("upstream detail", 502, "secret"));
        mvc.perform(post(path() + "/teaching-assignments").header("Authorization", "Bearer " + admin)
            .contentType("application/json").content(mapper.writeValueAsString(input())))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("upstream HTTP 502")));
        assertTrue(assignments.findByClassIdOrderByEffectiveFromAscIdAsc(cls.getId()).isEmpty());
    }
    @Test void sampleMetadataDiscoveredDuringFetchCannotVerifyTrainer() {
        setup.link(cls.getId(), program.getId()); when(directory.isSampleData()).thenReturn(false, true);
        assertThrows(ExternalApiException.class, () -> setup.saveAssignment(cls.getId(), null, input()));
        assertTrue(assignments.findByClassIdOrderByEffectiveFromAscIdAsc(cls.getId()).isEmpty());
    }
    @Test void trainerMustBeActiveUniqueAndMatchSavedMasterTrainer() {
        setup.link(cls.getId(), program.getId());
        for (var trainers : List.of(List.<ExternalTrainerDTO>of(),
                List.of(new ExternalTrainerDTO(9100L, "Verified Trainer", "t@example.test", "inactive")),
                List.of(new ExternalTrainerDTO(9100L, "Verified Trainer", "t@example.test", "active"), new ExternalTrainerDTO(9100L, "Duplicate", "d@example.test", "active")))) {
            when(directory.fetchTrainers("active")).thenReturn(trainers);
            assertThrows(BadRequestException.class, () -> setup.saveAssignment(cls.getId(), null, input()));
        }
        when(directory.fetchTrainers("active")).thenReturn(List.of(new ExternalTrainerDTO(9100L, "Other Trainer", "other@example.test", "active")));
        assertThrows(ConflictException.class, () -> setup.saveAssignment(cls.getId(), null, input()));
        assertEquals("Verified Trainer", classes.findById(cls.getId()).orElseThrow().getMasterTrainer());
    }
    @Test void rbacProtectsSetupProgramLinkAndAssignments() throws Exception {
        mvc.perform(get(path() + "/setup")).andExpect(status().isUnauthorized());
        mvc.perform(get(path() + "/setup").header("Authorization", "Bearer " + token("student@example.com"))).andExpect(status().isForbidden());
        var readOnly = limited("SETUP_READER", "CLASS_READ", "PROGRAM_READ", "ASSIGNMENT_READ");
        mvc.perform(get(path() + "/setup").header("Authorization", "Bearer " + readOnly)).andExpect(status().isOk());
        mvc.perform(put(path() + "/program-link").header("Authorization", "Bearer " + readOnly).contentType("application/json")
            .content("{\"programId\":" + program.getId() + "}")).andExpect(status().isForbidden());
        mvc.perform(post(path() + "/teaching-assignments").header("Authorization", "Bearer " + readOnly).contentType("application/json")
            .content(mapper.writeValueAsString(input()))).andExpect(status().isForbidden());
        setup.link(cls.getId(), program.getId()); var saved = setup.saveAssignment(cls.getId(), null, input());
        mvc.perform(put(path() + "/teaching-assignments/" + saved.id()).header("Authorization", "Bearer " + readOnly).contentType("application/json")
            .content(mapper.writeValueAsString(input()))).andExpect(status().isForbidden());
    }
    @Test void createPermissionDoesNotGrantUpdateAndUpdateDoesNotGrantCreate() throws Exception {
        setup.link(cls.getId(), program.getId()); var saved = setup.saveAssignment(cls.getId(), null, input());
        var createOnly = limited("SETUP_CREATOR", "CLASS_READ", "PROGRAM_READ", "ASSIGNMENT_CREATE");
        var updateOnly = limited("SETUP_EDITOR", "CLASS_READ", "PROGRAM_READ", "ASSIGNMENT_UPDATE");
        mvc.perform(put(path() + "/teaching-assignments/" + saved.id()).header("Authorization", "Bearer " + createOnly).contentType("application/json")
            .content(mapper.writeValueAsString(input()))).andExpect(status().isForbidden());
        mvc.perform(post(path() + "/teaching-assignments").header("Authorization", "Bearer " + updateOnly).contentType("application/json")
            .content(mapper.writeValueAsString(input()))).andExpect(status().isForbidden());
    }
    @Test void changingLinkedProgramWithActiveAssignmentsIsRejectedWithoutDeletingThem() {
        setup.link(cls.getId(), program.getId()); var saved = setup.saveAssignment(cls.getId(), null, input());
        var otherProgram = addProgram("OTHER_PROGRAM"); addSubject(otherProgram);
        cls.setProgram(otherProgram.getCode()); classes.saveAndFlush(cls);
        assertThrows(ConflictException.class, () -> setup.link(cls.getId(), otherProgram.getId()));
        assertEquals(program.getId(), links.findByClassId(cls.getId()).orElseThrow().getProgram().getId());
        assertTrue(assignments.findById(saved.id()).isPresent());
    }
    @Test void invalidJsonAndRequiredFieldsReturnBadRequest() throws Exception {
        mvc.perform(post(path() + "/teaching-assignments").header("Authorization", "Bearer " + admin).contentType("application/json")
            .content("{}")).andExpect(status().isBadRequest());
        mvc.perform(post(path() + "/teaching-assignments").header("Authorization", "Bearer " + admin).contentType("application/json")
            .content("{\"effectiveFrom\":\"not-a-date\"}")).andExpect(status().isBadRequest());
    }
}
