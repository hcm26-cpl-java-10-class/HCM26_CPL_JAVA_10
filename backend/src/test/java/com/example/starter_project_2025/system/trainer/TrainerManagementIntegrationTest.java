package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.training.*;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.trainingprogram.*;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:trainer_management;DB_CLOSE_DELAY=-1",
    "app.startup.mutations-enabled=false", "app.scheduling.enabled=false"})
@ActiveProfiles("test") @AutoConfigureMockMvc @Transactional
class TrainerManagementIntegrationTest {
    @Autowired TrainerService service;
    @Autowired TrainerRepository trainers;
    @Autowired TrainerImportService imports;
    @Autowired SubjectRepository subjects;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired RefreshTokenService tokens;
    @Autowired UserDetailsService users;
    @Autowired TrainingClassRepository classes;
    @Autowired TrainingClassService classService;
    @Autowired ClassSetupService setup;
    @Autowired ClassReadinessService readiness;
    @Autowired TrainingProgramRepository programs;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired jakarta.persistence.EntityManager em;
    String admin;
    Long topicId;
    @BeforeEach void init() {
        assertEquals(0, classes.count());
        assertEquals(0, trainers.count());
        com.example.starter_project_2025.support.TrainingTestFixtures.create(em,
            "TRAINER_READ", "TRAINER_CREATE", "TRAINER_UPDATE", "TRAINER_DELETE",
            "CLASS_READ", "CLASS_CREATE", "CLASS_UPDATE");
        admin = token("admin@example.com");
        topicId = subjects.findByIsActiveTrue().stream().findFirst().orElseThrow().getId();
    }
    String token(String email) {
        var user = users.loadUserByUsername(email);
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }
    CreateTrainerRequest input(String code, String email) {
        return new CreateTrainerRequest(code, "Trainer Test", email, "Java", TrainerStatus.ACTIVE, Set.of(topicId));
    }
    @Test void crudFilterSearchAndStableId() throws Exception {
        var created = mvc.perform(post("/api/trainers").header("Authorization", "Bearer " + admin)
            .contentType("application/json").content(mapper.writeValueAsBytes(input("TR_TEST", "tr@test.example"))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.source").value("INTERNAL")).andReturn();
        long id = mapper.readTree(created.getResponse().getContentAsString()).path("id").asLong();
        var update = new UpdateTrainerRequest("TR_UPDATED", "Updated Trainer", "updated@test.example", "Spring", TrainerStatus.ACTIVE, Set.of(topicId));
        mvc.perform(put("/api/trainers/" + id).header("Authorization", "Bearer " + admin).contentType("application/json")
            .content(mapper.writeValueAsBytes(update))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mvc.perform(get("/api/trainers").param("search", "Updated").param("status", "active").header("Authorization", "Bearer " + admin))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(id));
        mvc.perform(patch("/api/trainers/" + id + "/status").header("Authorization", "Bearer " + admin)
            .contentType("application/json").content("{\"status\":\"INACTIVE\"}")).andExpect(status().isOk());
        assertEquals(0, service.list("TR_UPDATED", "active", 0, 20).getTotalElements());
        mvc.perform(delete("/api/trainers/" + id).header("Authorization", "Bearer " + admin)).andExpect(status().isNoContent());
        assertTrue(trainers.existsById(id)); // soft archive
        mvc.perform(get("/api/trainers/" + id).header("Authorization", "Bearer " + admin)).andExpect(status().isNotFound());
    }
    @Test void duplicateCodeAndEmailAreCaseInsensitive() {
        service.create(input("TR_UNIQUE", "unique@test.example"));
        assertThrows(ConflictException.class, () -> service.create(input("tr_unique", "other@test.example")));
        assertThrows(ConflictException.class, () -> service.create(input("TR_OTHER", "UNIQUE@test.example")));
        assertEquals(0, service.list("TR_OTHER", "all", 0, 20).getTotalElements());
    }
    @Test void authorizationAndInvalidInput() throws Exception {
        mvc.perform(get("/api/trainers")).andExpect(status().isUnauthorized());
        String student = token("student@example.com");
        for (var request : List.of(get("/api/trainers"), get("/api/trainers/teaching-topics"), get("/api/trainers/import/template")))
            mvc.perform(request.header("Authorization", "Bearer " + student)).andExpect(status().isForbidden());
        mvc.perform(post("/api/trainers").header("Authorization", "Bearer " + student).contentType("application/json")
            .content(mapper.writeValueAsBytes(input("TR_RBAC", "rbac@test.example")))).andExpect(status().isForbidden());
        var r = input("TR_RBAC", "rbac@test.example");
        mvc.perform(put("/api/trainers/1").header("Authorization", "Bearer " + student).contentType("application/json")
            .content(mapper.writeValueAsBytes(r))).andExpect(status().isForbidden());
        mvc.perform(patch("/api/trainers/1/status").header("Authorization", "Bearer " + student).contentType("application/json")
            .content("{\"status\":\"ACTIVE\"}")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/trainers/1").header("Authorization", "Bearer " + student)).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/trainers/import").file(file(List.of(List.of("TR_RBAC", "Trainer", "rbac@test.example", "", "", ""))))
            .header("Authorization", "Bearer " + student)).andExpect(status().isForbidden());
        mvc.perform(get("/api/trainers").param("status", "invalid").header("Authorization", "Bearer " + admin)).andExpect(status().isBadRequest());
        assertThrows(BadRequestException.class, () -> service.create(new CreateTrainerRequest("TR_BAD", "Bad", "bad@test.example", "", TrainerStatus.ACTIVE, Set.of(Long.MAX_VALUE))));
    }
    @Test void excelTemplatePreviewAtomicCommitAndRevalidation() throws Exception {
        byte[] template = imports.template();
        try (var workbook = new XSSFWorkbook(new java.io.ByteArrayInputStream(template))) {
            assertEquals("Trainer ID*", workbook.getSheetAt(0).getRow(0).getCell(0).getStringCellValue());
            assertEquals(0, workbook.getSheetAt(0).getLastRowNum()); // no fake trainers
        }
        var valid = file(List.of(List.of("TR_XLS1", "Excel One", "xls1@test.example", "Java", "", "ACTIVE"),
            List.of("TR_XLS2", "Excel Two", "xls2@test.example", "", "", "INACTIVE")));
        assertTrue(imports.preview(valid).canImport());
        assertEquals(2, imports.commit(valid).imported());
        assertFalse(imports.preview(valid).canImport());
        var invalid = file(List.of(List.of("TR_ATOMIC", "Valid Row", "atomic@test.example", "", "", ""),
            List.of("TR_INVALID", "", "invalid-email", "", "MISSING@1", "WRONG")));
        assertFalse(imports.preview(invalid).canImport());
        assertThrows(BusinessValidationException.class, () -> imports.commit(invalid));
        assertEquals(0, service.list("TR_ATOMIC", "all", 0, 20).getTotalElements());
    }
    @Test void workEmailRuleIsSynchronizedAcrossApiEntityPreviewAndCommit() throws Exception {
        // review@localhost lacks a dot in domain -> rejected consistently across create API, update API, preview and commit
        mvc.perform(post("/api/trainers").header("Authorization", "Bearer " + admin)
                .contentType("application/json").content(mapper.writeValueAsBytes(input("TR_LOCAL", "review@localhost"))))
            .andExpect(status().isBadRequest());

        var existing = service.create(input("TR_VALID_MAIL", "valid@company.com"));
        var badUpdate = new UpdateTrainerRequest("TR_VALID_MAIL", "Trainer Test", "review@localhost", "Java", TrainerStatus.ACTIVE, Set.of(topicId));
        mvc.perform(put("/api/trainers/" + existing.id()).header("Authorization", "Bearer " + admin)
                .contentType("application/json").content(mapper.writeValueAsBytes(badUpdate)))
            .andExpect(status().isBadRequest());

        var mixedFile = file(List.of(
            List.of("TR_IMP_OK", "Good Trainer", "good@company.com", "Java", "", "ACTIVE"),
            List.of("TR_IMP_BAD", "Local Email", "review@localhost", "Java", "", "ACTIVE")
        ));
        var preview = imports.preview(mixedFile);
        assertFalse(preview.canImport());
        assertEquals(2, preview.totalRows());
        assertEquals(1, preview.validRows());
        assertTrue(preview.rows().get(0).valid());
        assertFalse(preview.rows().get(1).valid());
        assertEquals(3, preview.rows().get(1).rowNumber());
        assertTrue(preview.rows().get(1).errors().stream().anyMatch(e -> e.toLowerCase(Locale.ROOT).contains("email")));

        // Atomic commit rejects the whole file without saving row 2
        assertThrows(BusinessValidationException.class, () -> imports.commit(mixedFile));
        assertEquals(0, service.list("TR_IMP_OK", "all", 0, 20).getTotalElements());
    }
    @Test void excelDuplicatesOnBothRowsAndFormulaRejection() throws Exception {
        var duplicates = file(List.of(List.of("TR_DUP", "One", "dup@test.example", "", "", ""), List.of("tr_dup", "Two", "DUP@test.example", "", "", "")));
        assertTrue(imports.preview(duplicates).rows().stream().allMatch(r -> !r.valid()));
        try (var workbook = new XSSFWorkbook(new java.io.ByteArrayInputStream(imports.template())); var out = new ByteArrayOutputStream()) {
            workbook.getSheetAt(0).createRow(1).createCell(0).setCellFormula("1+1"); workbook.write(out);
            assertThrows(BadRequestException.class, () -> imports.preview(new MockMultipartFile("file", "trainers.xlsx", "application/octet-stream", out.toByteArray())));
        }
    }
    @Test void explicitInternalIdentityAssignmentsReadinessAndArchiveGuard() {
        var trainer = service.create(input("TR_ASSIGN", "assign@test.example"));
        var program = new TrainingProgram(); program.setCode("TR_PROGRAM"); program.setName("Trainer Program"); program.setVersion("1"); program.setStatus(ProgramStatus.ACTIVE); programs.saveAndFlush(program);
        var ps = new ProgramSubject(); ps.setProgram(program); ps.setSubject(subjects.findById(topicId).orElseThrow()); ps.setOrderIndex(1); em.persist(ps); em.flush();
        var cls = new TrainingClass(); cls.setCode("TR_CLASS"); cls.setName("Trainer Class"); cls.setStatus("planning"); cls.setProgram(program.getCode());
        cls.setMasterTrainer(trainer.fullName()); cls.setMasterTrainerId(trainer.id()); cls.setClassAdmin("Saved Admin"); cls.setPlannedSize(20);
        cls.setStartDate(LocalDate.of(2030, 1, 1)); cls.setEndDate(LocalDate.of(2030, 3, 1)); classes.saveAndFlush(cls);
        setup.link(cls.getId(), program.getId());
        // A legacy external assignment with the same numeric ID is not internal evidence.
        var legacy = new TeachingAssignment(); legacy.setClassId(cls.getId()); legacy.setProgramSubject(ps); legacy.setTrainerId(trainer.id());
        legacy.setRole(AssignmentRole.MAIN); legacy.setEffectiveFrom(cls.getStartDate()); legacy.setEffectiveTo(cls.getEndDate()); assignments.saveAndFlush(legacy);
        assertEquals(ClassReadinessService.State.NOT_READY, readiness.get(cls.getId()).checks().stream().filter(c -> c.key().equals("trainer")).findFirst().orElseThrow().status());
        assertNull(assignments.findById(legacy.getId()).orElseThrow().getTrainerSource());
        var input = new TeachingAssignmentRequest(cls.getId(), ps.getId(), trainer.id(), AssignmentRole.MAIN, cls.getStartDate(), cls.getEndDate(), "INTERNAL");
        var result = setup.saveAssignment(cls.getId(), legacy.getId(), input); // explicit user update
        assertEquals(trainer.id(), result.trainerId()); assertEquals("INTERNAL", result.trainerSource());
        assertEquals(ClassReadinessService.State.READY, readiness.get(cls.getId()).checks().stream().filter(c -> c.key().equals("trainer")).findFirst().orElseThrow().status());
        assertThrows(ConflictException.class, () -> service.delete(trainer.id()));
        service.update(trainer.id(), new UpdateTrainerRequest(trainer.trainerCode(), "Renamed Trainer", trainer.email(), "Java", TrainerStatus.ACTIVE, Set.of(topicId)));
        assertEquals(ClassReadinessService.State.READY, readiness.get(cls.getId()).checks().stream().filter(c -> c.key().equals("trainer")).findFirst().orElseThrow().status());
        assertEquals(trainer.fullName(), classes.findById(cls.getId()).orElseThrow().getMasterTrainer()); // no historical text rewrite
        service.changeStatus(trainer.id(), TrainerStatus.INACTIVE);
        assertEquals(ClassReadinessService.State.NOT_READY, readiness.get(cls.getId()).checks().stream().filter(c -> c.key().equals("trainer")).findFirst().orElseThrow().status());
    }
    @Test void internalAssignmentRequiresExplicitClassSelectionAndTopicEligibility() {
        var trainer = service.create(new CreateTrainerRequest("TR_NO_TOPICS", "No Topics", "notopics@test.example", "", TrainerStatus.ACTIVE, Set.of()));
        var p = new TrainingProgram(); p.setCode("TR_ELIGIBLE"); p.setName("Eligibility"); p.setVersion("1"); p.setStatus(ProgramStatus.ACTIVE); programs.saveAndFlush(p);
        var ps = new ProgramSubject(); ps.setProgram(p); ps.setSubject(subjects.findById(topicId).orElseThrow()); ps.setOrderIndex(1); em.persist(ps); em.flush();
        var c = new TrainingClass(); c.setCode("TR_ELIG_CLASS"); c.setName("Eligibility Class"); c.setStatus("planning"); c.setProgram(p.getCode());
        c.setClassAdmin("Admin"); c.setMasterTrainer(trainer.fullName()); c.setPlannedSize(20); c.setStartDate(LocalDate.of(2030, 1, 1)); c.setEndDate(LocalDate.of(2030, 2, 1)); classes.saveAndFlush(c);
        setup.link(c.getId(), p.getId());
        var request = new TeachingAssignmentRequest(c.getId(), ps.getId(), trainer.id(), AssignmentRole.MAIN, c.getStartDate(), c.getEndDate(), "INTERNAL");
        assertThrows(ConflictException.class, () -> setup.saveAssignment(c.getId(), null, request));
        assertNull(classes.findById(c.getId()).orElseThrow().getMasterTrainerId());
        c.setMasterTrainerId(trainer.id()); classes.saveAndFlush(c);
        assertThrows(BadRequestException.class, () -> setup.saveAssignment(c.getId(), null, request));
        assertTrue(assignments.findByClassIdOrderByEffectiveFromAscIdAsc(c.getId()).isEmpty());
    }
    @Test void classApiRejectsInactiveOrMismatchedIdentityAndPreservesString() {
        var trainer = service.create(input("TR_CLASS_API", "class@test.example"));
        var c = new TrainingClassDTO(); c.setCode("TR_API_CLASS"); c.setName("Class API"); c.setStatus("planning"); c.setProgram("PROGRAM");
        c.setClassAdmin("Existing Admin"); c.setPlannedSize(20); c.setStartDate(LocalDate.of(2030, 1, 1)); c.setEndDate(LocalDate.of(2030, 3, 1));
        c.setMasterTrainerId(trainer.id()); c.setMasterTrainer("Wrong name");
        assertThrows(BadRequestException.class, () -> classService.create(c));
        c.setMasterTrainer(trainer.fullName()); var saved = classService.create(c);
        assertEquals(trainer.id(), saved.getMasterTrainerId()); assertEquals(trainer.fullName(), saved.getMasterTrainer());
        assertEquals("Existing Admin", saved.getClassAdmin());
        service.changeStatus(trainer.id(), TrainerStatus.INACTIVE); c.setCode("TR_API_INACTIVE");
        assertThrows(BadRequestException.class, () -> classService.create(c));
    }
    @Test void changedMasterTrainerPersistsThroughUpdateDetailAndListReload() throws Exception {
        var first = service.create(input("TR_FIRST", "first@test.example"));
        var second = service.create(new CreateTrainerRequest("TR_SECOND", "Second Trainer", "second@test.example", "Java", TrainerStatus.ACTIVE, Set.of(topicId)));
        var input = classInput(first);
        var saved = classService.create(input);
        input.setMasterTrainerId(second.id()); input.setMasterTrainer(second.fullName());
        mvc.perform(put("/api/classes/" + saved.getId()).header("Authorization", "Bearer " + admin)
                .contentType("application/json").content(mapper.writeValueAsBytes(input)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.masterTrainerId").value(second.id()))
            .andExpect(jsonPath("$.masterTrainer").value(second.fullName()));
        em.flush(); em.clear(); // Read from H2 again, not the managed entity or the PUT response.
        mvc.perform(get("/api/classes/" + saved.getId()).header("Authorization", "Bearer " + admin))
            .andExpect(status().isOk()).andExpect(jsonPath("$.masterTrainerId").value(second.id()))
            .andExpect(jsonPath("$.masterTrainer").value(second.fullName()))
            .andExpect(jsonPath("$.classAdmin").value("Existing Admin"))
            .andExpect(jsonPath("$.program").value("PROGRAM"))
            .andExpect(jsonPath("$.plannedSize").value(20))
            .andExpect(jsonPath("$.startDate").value("2030-01-01"))
            .andExpect(jsonPath("$.endDate").value("2030-03-01"));
        mvc.perform(get("/api/classes").param("search", saved.getCode()).header("Authorization", "Bearer " + admin))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].masterTrainerId").value(second.id()))
            .andExpect(jsonPath("$.content[0].masterTrainer").value(second.fullName()));
    }

    @Test void optionsExcludeInactiveAndArchivedAndFailedUpdatesRetainSavedTrainer() throws Exception {
        var original = service.create(input("TR_ORIGINAL", "original@test.example"));
        var inactive = service.create(input("TR_INACTIVE", "inactive@test.example"));
        service.changeStatus(inactive.id(), TrainerStatus.INACTIVE);
        var archived = service.create(input("TR_ARCHIVED", "archived@test.example"));
        service.delete(archived.id());
        mvc.perform(get("/api/trainers/options").header("Authorization", "Bearer " + admin))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].id").value(original.id()))
            .andExpect(jsonPath("$.content[0].status").value("ACTIVE"));
        var input = classInput(original); var saved = classService.create(input);
        for (Long rejectedId : List.of(inactive.id(), archived.id(), Long.MAX_VALUE)) {
            input.setMasterTrainerId(rejectedId);
            mvc.perform(put("/api/classes/" + saved.getId()).header("Authorization", "Bearer " + admin)
                    .contentType("application/json").content(mapper.writeValueAsBytes(input)))
                .andExpect(status().isBadRequest());
            em.clear();
            assertEquals(original.id(), classService.get(saved.getId()).getMasterTrainerId());
        }
        mvc.perform(put("/api/classes/" + saved.getId()).header("Authorization", "Bearer " + token("student@example.com"))
                .contentType("application/json").content(mapper.writeValueAsBytes(classInput(original))))
            .andExpect(status().isForbidden());
    }

    @Test void classReadAuthorityCanReadOptionsButCannotUpdateClassesOrManageTrainers() throws Exception {
        var readerRole = new com.example.starter_project_2025.system.rbac.role.Role();
        readerRole.setName("CLASS_READER_ONLY");
        var classRead = em.createQuery("select p from Permission p where p.name='CLASS_READ'", com.example.starter_project_2025.system.rbac.permission.Permission.class).getSingleResult();
        readerRole.setPermissions(new HashSet<>(Set.of(classRead))); em.persist(readerRole);
        var reader = new com.example.starter_project_2025.system.rbac.user.User();
        reader.setEmail("class-reader@test.example"); reader.setFirstName("Class"); reader.setLastName("Reader");
        reader.setPasswordHash("unused-test-hash"); reader.setRoles(new HashSet<>(Set.of(readerRole))); em.persist(reader); em.flush();
        String readerToken = token(reader.getEmail());
        mvc.perform(get("/api/trainers/options").header("Authorization", "Bearer " + readerToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/trainers/data-source").header("Authorization", "Bearer " + readerToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.source").value("INTERNAL"));
        mvc.perform(get("/api/trainers").header("Authorization", "Bearer " + readerToken)).andExpect(status().isForbidden());
        var trainer = service.create(input("TR_READER", "reader-trainer@test.example"));
        var input = classInput(trainer); var saved = classService.create(input);
        mvc.perform(put("/api/classes/" + saved.getId()).header("Authorization", "Bearer " + readerToken)
                .contentType("application/json").content(mapper.writeValueAsBytes(input))).andExpect(status().isForbidden());
    }

    TrainingClassDTO classInput(TrainerDTO trainer) {
        var input = new TrainingClassDTO(); input.setCode("TR_CHANGE_CLASS"); input.setName("Trainer Change Class");
        input.setStatus("planning"); input.setProgram("PROGRAM"); input.setClassAdmin("Existing Admin"); input.setPlannedSize(20);
        input.setStartDate(LocalDate.of(2030, 1, 1)); input.setEndDate(LocalDate.of(2030, 3, 1));
        input.setMasterTrainerId(trainer.id()); input.setMasterTrainer(trainer.fullName());
        return input;
    }

    MockMultipartFile file(List<List<String>> rows) throws Exception {
        try (var workbook = new XSSFWorkbook(new java.io.ByteArrayInputStream(imports.template())); var out = new ByteArrayOutputStream()) {
            int n = 1; for (var cells : rows) { var row = workbook.getSheetAt(0).createRow(n++); for (int i = 0; i < cells.size(); i++) row.createCell(i).setCellValue(cells.get(i)); }
            workbook.write(out); return new MockMultipartFile("file", "trainers.xlsx", "application/octet-stream", out.toByteArray());
        }
    }
}
