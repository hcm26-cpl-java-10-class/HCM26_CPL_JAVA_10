package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.study_session.*;
import com.example.starter_project_2025.system.trainingprogram.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:subject_completion;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.devtools.restart.enabled=false",
        "logging.level.root=WARN", "logging.level.org.hibernate.SQL=OFF"
})
@AutoConfigureMockMvc
class SubjectCompletionApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SubjectRepository subjects;
    @Autowired SubjectService service;
    @Autowired SubjectExportService exportService;
    @Autowired SubjectImportService imports;
    @Autowired SubjectStatusInitializer statusInitializer;
    @Autowired TrainingProgramRepository programs;
    @Autowired ProgramSubjectRepository programSubjects;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired SessionRepository sessions;
    @Autowired StudySessionRepository studySessions;
    String bearer;

    @BeforeEach void login() throws Exception {
        var body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        bearer = "Bearer " + json.readTree(body).path("accessToken").asText();
    }
    @AfterEach void clearAuthentication() { SecurityContextHolder.clearContext(); }
    private String code() { return "COMP_" + UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT); }
    private Map<String, Object> request(String code) {
        return new LinkedHashMap<>(Map.of("code", code, "name", "Full subject", "version", "1.0", "durationHours", 8,
                "isActive", true, "objectives", "Understand OOP", "skills", "Java", "deliveryMode", "HYBRID", "outline", "Week 1: Basics"));
    }
    private Subject create() throws Exception { return create(request(code())); }
    private Subject create(Map<String, Object> body) throws Exception {
        var response = mvc.perform(post("/api/subjects").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return subjects.findById(json.readTree(response).path("id").asLong()).orElseThrow();
    }
    private ProgramSubject useInProgram(Subject subject) {
        var program = programs.saveAndFlush(TrainingProgram.builder().code(code()).name("Program")
                .version("1.0").status(ProgramStatus.ACTIVE).build());
        var entry = new ProgramSubject(); entry.setProgram(program); entry.setSubject(subject); entry.setOrderIndex(1);
        return programSubjects.saveAndFlush(entry);
    }
    private void useInStudySession(Subject subject) {
        studySessions.saveAndFlush(StudySession.builder().subjectId(subject.getId()).title("Referenced study session")
                .sessionDate(LocalDate.of(2026, 11, 2)).startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(10, 0))
                .lecturer("Trainer").type(StudySessionType.LECTURE).build());
    }
    private MockMultipartFile csv(String value) { return new MockMultipartFile("file", "subjects.CSV", "text/csv", value.getBytes(StandardCharsets.UTF_8)); }
    private void authenticate(String... permissions) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("subject-tester", "n/a",
                Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }

    @Test void completeLearningContentIsStoredAndReturned() throws Exception {
        var subject = create();
        mvc.perform(get("/api/subjects/" + subject.getId()).header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.objectives").value("Understand OOP")).andExpect(jsonPath("$.skills").value("Java"))
                .andExpect(jsonPath("$.deliveryMode").value("HYBRID")).andExpect(jsonPath("$.outline").value("Week 1: Basics"));
    }
    @Test void cloningCopiesContentToANewInactiveVersionWithoutChangingReferences() throws Exception {
        var original = create(); var entry = useInProgram(original);
        var response = mvc.perform(post("/api/subjects/" + original.getId() + "/clone").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":\" V2.0 \"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.version").value("2.0"))
                .andExpect(jsonPath("$.isActive").value(false)).andExpect(jsonPath("$.status").value("INACTIVE"))
                .andExpect(jsonPath("$.objectives").value(original.getObjectives())).andReturn().getResponse().getContentAsString();
        var copyId = json.readTree(response).path("id").asLong();
        assertNotEquals(original.getId(), copyId);
        assertEquals("1.0", subjects.findById(original.getId()).orElseThrow().getVersion());
        assertEquals(original.getId(), programSubjects.findById(entry.getId()).orElseThrow().getSubject().getId());
        assertEquals(original.getOutline(), subjects.findById(copyId).orElseThrow().getOutline());
    }
    @Test void duplicateAndBlankCloneVersionsAreRejectedAndMissingSourceReturns404() throws Exception {
        var subject = create(); long count = subjects.count();
        for (String version : List.of("v1.0", " ", "a".repeat(21))) {
            mvc.perform(post("/api/subjects/" + subject.getId() + "/clone").header("Authorization", bearer)
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("version", version))))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/subjects/999999999/clone").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":\"2.0\"}")).andExpect(status().isNotFound());
        assertEquals(count, subjects.count());
    }
    @Test void usedContentIsImmutableButStatusCanBeChangedByBothWriteRoutes() throws Exception {
        var subject = create(); useInProgram(subject);
        for (Map<String, Object> change : List.of(Map.<String, Object>of("name", "Changed"), Map.<String, Object>of("outline", "Changed"),
                Map.<String, Object>of("durationHours", 20), Map.<String, Object>of("version", "2.0"))) {
            mvc.perform(put("/api/subjects/" + subject.getId()).header("Authorization", bearer)
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(change)))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.version[0]", containsString("Clone")));
        }
        mvc.perform(put("/api/subjects/" + subject.getId()).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"isActive\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("INACTIVE"));
        mvc.perform(patch("/api/subjects/" + subject.getId() + "/status").param("active", "true").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        assertEquals(subject.getName(), subjects.findById(subject.getId()).orElseThrow().getName());
    }
    @Test void programAndAssignmentUsageIsCountedWithoutQueryingMissingColumns() throws Exception {
        var subject = create(); var entry = useInProgram(subject);
        var assignment = new TeachingAssignment(); assignment.setProgramSubject(entry); assignment.setClassId(1L);
        assignment.setTrainerId(1L); assignment.setRole(AssignmentRole.MAIN); assignment.setEffectiveFrom(LocalDate.of(2026, 1, 1));
        assignments.saveAndFlush(assignment);
        mvc.perform(get("/api/subjects/" + subject.getId() + "/usage").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.programSubjects").value(1))
                .andExpect(jsonPath("$.teachingAssignments").value(1)).andExpect(jsonPath("$.referenced").value(true));
        mvc.perform(delete("/api/subjects/" + subject.getId()).header("Authorization", bearer)).andExpect(status().isBadRequest());
    }
    @Test void studySessionReferenceAloneProtectsBothEditingAndDeletion() throws Exception {
        var subject = create(); useInStudySession(subject);
        mvc.perform(get("/api/subjects/" + subject.getId() + "/usage").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.studySessions").value(1)).andExpect(jsonPath("$.referenced").value(true));
        mvc.perform(delete("/api/subjects/" + subject.getId()).header("Authorization", bearer)).andExpect(status().isBadRequest());
        mvc.perform(put("/api/subjects/" + subject.getId()).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"Changed\"}")).andExpect(status().isBadRequest());
    }
    @Test void legacySessionReferenceAlsoProtectsSubject() throws Exception {
        var subject = create();
        sessions.saveAndFlush(Session.builder().classId(1L).topicId(subject.getId()).trainerId(1L).title("Reference")
                .startTime(LocalDateTime.of(2026, 11, 1, 8, 0)).endTime(LocalDateTime.of(2026, 11, 1, 10, 0))
                .status(Session.SessionStatus.SCHEDULED).build());
        mvc.perform(get("/api/subjects/" + subject.getId() + "/usage").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sessions").value(1)).andExpect(jsonPath("$.referenced").value(true));
        mvc.perform(delete("/api/subjects/" + subject.getId()).header("Authorization", bearer)).andExpect(status().isBadRequest());
    }
    @Test void unusedSubjectsCanBeEditedAndDeleted() throws Exception {
        var subject = create();
        mvc.perform(put("/api/subjects/" + subject.getId()).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"outline\":\"Updated outline\",\"durationHours\":12}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.outline").value("Updated outline")).andExpect(jsonPath("$.durationHours").value(12));
        mvc.perform(delete("/api/subjects/" + subject.getId()).header("Authorization", bearer)).andExpect(status().isNoContent());
        assertFalse(subjects.existsById(subject.getId()));
    }
    @Test void draftStatusIsRejectedAndLegacyRowsAreReconciled() throws Exception {
        var body = request(code()); body.put("status", "DRAFT");
        mvc.perform(post("/api/subjects").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isBadRequest());
        var legacy = subjects.saveAndFlush(Subject.builder().code(code()).name("Legacy").version("1.0")
                .durationHours(4).status(SubjectStatus.DRAFT).isActive(true).build());
        statusInitializer.run();
        var saved = subjects.findById(legacy.getId()).orElseThrow();
        assertEquals(SubjectStatus.INACTIVE, saved.getStatus()); assertFalse(saved.getIsActive());
    }
    @Test void legacyLongDescriptionDoesNotPreventChangingOnlyStatus() throws Exception {
        var subject = subjects.saveAndFlush(Subject.builder().code(code()).name("Legacy content").version("1.0")
                .durationHours(4).description(String.join(" ", Collections.nCopies(501, "word"))).build());
        useInProgram(subject);
        mvc.perform(put("/api/subjects/" + subject.getId()).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"isActive\":false}")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("INACTIVE"));
        assertEquals(501, SubjectDescription.countWords(subjects.findById(subject.getId()).orElseThrow().getDescription()));
    }
    @Test void hoursAndContentLimitsCannotBeBypassedThroughApi() throws Exception {
        var subject = create();
        for (int hours : List.of(-1, 0)) {
            var body = request(code()); body.put("durationHours", hours);
            mvc.perform(post("/api/subjects").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(body))).andExpect(status().isBadRequest());
            mvc.perform(put("/api/subjects/" + subject.getId()).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("durationHours", hours)))).andExpect(status().isBadRequest());
        }
        mvc.perform(put("/api/subjects/" + subject.getId()).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("objectives", "x".repeat(4001))))).andExpect(status().isBadRequest());
    }
    @Test void fractionalJsonHoursAreRejectedRatherThanSilentlyRounded() throws Exception {
        var subject = create();
        mvc.perform(put("/api/subjects/" + subject.getId()).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"durationHours\":1.5}")).andExpect(status().isBadRequest());
        assertEquals(8, subjects.findById(subject.getId()).orElseThrow().getDurationHours());
    }
    @Test void listAndExportApplyTheSameSearchStatusAndHoursFiltersAcrossPages() throws Exception {
        String prefix = code();
        for (int i = 1; i <= 4; i++) {
            var body = request(prefix + "_" + i); body.put("durationHours", i * 10); body.put("isActive", i != 3); create(body);
        }
        mvc.perform(get("/api/subjects").header("Authorization", bearer).param("search", prefix)
                        .param("minHours", "15").param("maxHours", "40").param("isActive", "true").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.content", hasSize(1)));
        String exported = mvc.perform(get("/api/subjects/export/filtered").header("Authorization", bearer).param("format", "CSV")
                        .param("search", prefix).param("minHours", "15").param("maxHours", "40").param("isActive", "true").param("size", "1"))
                .andExpect(status().isOk()).andExpect(header().string("Content-Disposition", containsString(".csv")))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(exported.contains(prefix + "_2")); assertTrue(exported.contains(prefix + "_4"));
        assertFalse(exported.contains(prefix + "_1")); assertFalse(exported.contains(prefix + "_3"));
        assertTrue(exported.lines().findFirst().orElseThrow().contains("Hours"));
    }
    @Test void invertedHoursRangeIsRejected() throws Exception {
        mvc.perform(get("/api/subjects").header("Authorization", bearer).param("minHours", "20").param("maxHours", "10"))
                .andExpect(status().isBadRequest());
    }
    @Test void previewDoesNotWriteAndImportCommitsOnlyValidRowsWithCorrectRowNumbers() throws Exception {
        var existing = create(); String newCode = code();
        var file = csv("\uFEFFCode,Name,Version,Hours,Status\n\n" + newCode + ",Valid,v1.0,4,ACTIVE\n"
                + newCode.toLowerCase(Locale.ROOT) + ",Duplicate,1.0,4,ACTIVE\n" + code() + ",Negative,1.0,-1,ACTIVE\n"
                + existing.getCode() + ",Existing,1.0,4,ACTIVE\n");
        long count = subjects.count();
        mvc.perform(multipart("/api/subjects/import/preview").file(file).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.validRows").value(1)).andExpect(jsonPath("$.invalidRows").value(3))
                .andExpect(jsonPath("$.rows[0].rowNumber").value(3)).andExpect(jsonPath("$.rows[0].valid").value(true));
        assertEquals(count, subjects.count());
        mvc.perform(multipart("/api/subjects/import").file(file).header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(1)).andExpect(jsonPath("$.failureCount").value(3))
                .andExpect(jsonPath("$.errors[0].rowNumber").value(4));
        assertEquals(count + 1, subjects.count());
    }
    @Test void inactiveImportSynchronizesStatusAndPreservesUnicodeAndMultilineContent() throws Exception {
        String code = code();
        var file = csv("Code,Name,Version,Hours,Status,Outline\n" + code + ",Lập trình,1.0,4,INACTIVE,\"Dòng 1\nDòng 2\"\n");
        mvc.perform(multipart("/api/subjects/import").file(file).header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(1));
        var subject = subjects.findByCodeAndVersion(code, "1.0").orElseThrow();
        assertFalse(subject.getIsActive()); assertEquals(SubjectStatus.INACTIVE, subject.getStatus());
        assertEquals("Lập trình", subject.getName()); assertEquals("Dòng 1\nDòng 2", subject.getOutline());
    }
    @Test void excelPreviewHandlesBlankRowsAndNumericHoursWithoutWriting() throws Exception {
        byte[] bytes;
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Subjects"); var header = sheet.createRow(0);
            var names = List.of("Code", "Name", "Version", "Hours");
            for (int i = 0; i < names.size(); i++) header.createCell(i).setCellValue(names.get(i));
            var row = sheet.createRow(2); row.createCell(0).setCellValue(code()); row.createCell(1).setCellValue("Excel");
            row.createCell(2).setCellValue("1.0"); row.createCell(3).setCellValue(4);
            workbook.write(output); bytes = output.toByteArray();
        }
        long count = subjects.count();
        mvc.perform(multipart("/api/subjects/import/preview").file(new MockMultipartFile("file", "subjects.xlsx", "application/octet-stream", bytes))
                        .header("Authorization", bearer)).andExpect(status().isOk()).andExpect(jsonPath("$.validRows").value(1))
                .andExpect(jsonPath("$.rows[0].rowNumber").value(3));
        assertEquals(count, subjects.count());
    }
    @Test void invalidHeadersEmptyAndOversizedFilesAreRejectedBeforeWriting() throws Exception {
        long count = subjects.count();
        for (var file : List.of(csv("Code,Name,Version\nx,Name,1.0\n"), csv("Code,Code,Name,Version,Hours\nx,x,Name,1.0,4\n"), csv(""),
                new MockMultipartFile("file", "large.csv", "text/csv", new byte[SubjectImportReader.MAX_FILE_BYTES + 1]))) {
            mvc.perform(multipart("/api/subjects/import/preview").file(file).header("Authorization", bearer)).andExpect(status().isBadRequest());
        }
        assertEquals(count, subjects.count());
    }
    @Test void importRevalidatesWhenDatabaseChangesAfterPreview() throws Exception {
        String code = code(); var file = csv("Code,Name,Version,Hours\n" + code + ",Preview,1.0,4\n");
        mvc.perform(multipart("/api/subjects/import/preview").file(file).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.validRows").value(1));
        create(request(code));
        mvc.perform(multipart("/api/subjects/import").file(file).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(0)).andExpect(jsonPath("$.failureCount").value(1));
    }
    @Test void newTemplateUsesHoursAndIsProtected() throws Exception {
        String body = mvc.perform(get("/api/subjects/import-template").header("Authorization", bearer))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(body.contains(",Hours,")); assertFalse(body.contains("Duration"));
        mvc.perform(get("/api/subjects/import-template")).andExpect(status().isUnauthorized());
    }
    @Test void readOnlyAuthorityCannotCloneImportOrChangeStatus() throws Exception {
        var subject = create(); authenticate("SUBJECT_READ");
        assertDoesNotThrow(() -> service.getActiveSubjects());
        assertThrows(AccessDeniedException.class, () -> service.cloneVersion(subject.getId(), new SubjectCloneRequest("2.0")));
        assertThrows(AccessDeniedException.class, () -> service.changeStatus(subject.getId(), false));
        assertThrows(AccessDeniedException.class, () -> imports.preview(csv("Code,Name,Version,Hours\nx,x,1.0,4\n")));
    }
    @Test void unrelatedAuthorityCannotReadActiveUsageOrExport() throws Exception {
        var subject = create(); authenticate("COURSE_READ");
        assertThrows(AccessDeniedException.class, () -> service.getActiveSubjects());
        assertThrows(AccessDeniedException.class, () -> service.isSubjectReferenced(subject.getId()));
        assertThrows(AccessDeniedException.class, () -> exportService.export(
                com.example.starter_project_2025.base.dataio.common.FileFormat.CSV, null, null,
                org.springframework.data.domain.Sort.unsorted(), new MockHttpServletResponse()));
    }
}
