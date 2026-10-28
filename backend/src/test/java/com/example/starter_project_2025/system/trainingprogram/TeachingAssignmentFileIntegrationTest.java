package com.example.starter_project_2025.system.trainingprogram;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:assignment_file_test;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE")
@AutoConfigureMockMvc
@ActiveProfiles("local")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class TeachingAssignmentFileIntegrationTest {
    private static final String HEADER = "Class ID,Program Subject ID,Trainer ID,Role,Effective From,Effective To\n";
    private static final String DETAILS_HEADER = "Class Name,Class Start Date,Class End Date,Planned Size,Program Name,Program Version,Subject Name,Duration Hours,Trainer Name,Trainer Email,Role,Effective From,Effective To\n";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ProgramSubjectRepository programSubjects;
    @Autowired com.example.starter_project_2025.system.external_api.ManagedTeachingClassRepository classes;
    @Autowired com.example.starter_project_2025.system.external_api.ManagedTeachingTrainerRepository trainers;
    @Autowired TrainingProgramRepository programs;
    @Autowired com.example.starter_project_2025.system.subject.SubjectRepository subjects;
    private String bearer;
    private long programSubjectId;

    @BeforeEach
    void prepare() throws Exception {
        assignments.deleteAll();
        bearer = login("admin@example.com");
        var context = mvc.perform(get("/api/teaching-assignments/create-context").param("classId", "1")
                .header("Authorization", bearer)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        programSubjectId = mapper.readTree(context).get("subjects").get(0).get("programSubjectId").asLong();
    }

    @Test
    @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named = "assignment.import.fixture", matches = ".+")
    void importsProvided100RowWorkbook() throws Exception {
        var path = java.nio.file.Path.of(System.getProperty("assignment.import.fixture"));
        mvc.perform(multipart("/api/teaching-assignments/import")
                .file(new MockMultipartFile("file", path.getFileName().toString(), "application/octet-stream", java.nio.file.Files.readAllBytes(path)))
                .header("Authorization", bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(100))
                .andExpect(jsonPath("$.failureCount").value(0));
        assertThat(assignments.count()).isEqualTo(100);
    }

    @Test
    void creates100NewClassesSubjectsTrainersAndAssignmentsFromXlsxWithoutIds() throws Exception {
        long classCount = classes.count(), trainerCount = trainers.count(), subjectCount = subjects.count(), programCount = programs.count();
        String prefix = "Import " + java.util.UUID.randomUUID();
        try (var workbook = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Import");
            var header = sheet.createRow(0);
            var names = DETAILS_HEADER.trim().split(",");
            for (int col = 0; col < names.length; col++) header.createCell(col).setCellValue(names[col]);
            for (int number = 1; number <= 100; number++) {
                var row = sheet.createRow(number);
                String[] values = {prefix + number, "2026-10-01", "2026-12-31", "25", prefix + " Program " + number,
                        "1.0", "Java " + number, "8", "Trainer " + number, prefix.replace(" ", "") + number + "@example.com",
                        "MAIN", "2026-10-01", "2026-10-31"};
                for (int col = 0; col < values.length; col++) row.createCell(col).setCellValue(values[col]);
            }
            workbook.write(out);
            mvc.perform(multipart("/api/teaching-assignments/import")
                    .file(new MockMultipartFile("file", "new-details.xlsx", "application/octet-stream", out.toByteArray()))
                    .header("Authorization", bearer)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.successCount").value(100)).andExpect(jsonPath("$.failureCount").value(0));
        }
        assertThat(assignments.count()).isEqualTo(100);
        assertThat(classes.count()).isEqualTo(classCount + 100);
        assertThat(trainers.count()).isEqualTo(trainerCount + 100);
        assertThat(subjects.count()).isEqualTo(subjectCount + 100);
        assertThat(programs.count()).isEqualTo(programCount + 100);
    }

    @Test
    void detailsImportRollsBackFailedRowsRejectsDuplicatesAndReusesMatchingTrainer() throws Exception {
        long classCount = classes.count(), trainerCount = trainers.count(), subjectCount = subjects.count(), programCount = programs.count();
        String name = "CSV " + java.util.UUID.randomUUID();
        String row = name + ",2026-10-01,2026-12-31,25,Program,1.0,Java,8,CSV Trainer," + name.replace(" ", "")
                + "@example.com,MAIN,2026-10-01,2026-10-31\n";
        upload(DETAILS_HEADER + row.replace("MAIN,2026-10-01", "MAIN,2026-09-01")
                + row + row + row.replace(name + ",", name + " second,"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(2))
                .andExpect(jsonPath("$.failureCount").value(2))
                .andExpect(jsonPath("$.errors[0].rowNumber").value(2))
                .andExpect(jsonPath("$.errors[1].rowNumber").value(4));
        assertThat(classes.count()).isEqualTo(classCount + 2);
        assertThat(trainers.count()).isEqualTo(trainerCount + 1);
        assertThat(subjects.count()).isEqualTo(subjectCount + 2);
        assertThat(programs.count()).isEqualTo(programCount + 2);
        assertThat(assignments.count()).isEqualTo(2);
        upload(DETAILS_HEADER + row.replace("25,", "0,"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.failureCount").value(1));
        upload(DETAILS_HEADER + row.replace("@example.com", ""))
                .andExpect(status().isOk()).andExpect(jsonPath("$.failureCount").value(1));
        assertThat(classes.count()).isEqualTo(classCount + 2);
    }

    @Test
    void reportsMissingClassIdsAcross100RowsAndStillCommitsValidRows() throws Exception {
        var rows = new StringBuilder(HEADER);
        for (int number = 0; number < 99; number++) {
            rows.append(8858610016823783L + number).append(",")
                    .append(programSubjectId).append(",1,MAIN,2026-10-01,\n");
        }
        rows.append("1,").append(programSubjectId).append(",1,MAIN,2026-10-01,\n");
        upload(rows.toString()).andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(1))
                .andExpect(jsonPath("$.failureCount").value(99))
                .andExpect(jsonPath("$.errors[0].rowNumber").value(2))
                .andExpect(jsonPath("$.errors[0].message").value(org.hamcrest.Matchers.containsString("8858610016823783")))
                .andExpect(jsonPath("$.errors[98].message").value(org.hamcrest.Matchers.containsString("Class not found")));
        assertThat(assignments.count()).isEqualTo(1);
    }

    @Test
    void importsValidRowsIndependentlyAndReportsConflictsWithoutOverwriting() throws Exception {
        String row = "1," + programSubjectId + ",1,MAIN,2026-10-01,2026-10-31\n";
        upload(HEADER + row + row + "1," + programSubjectId + ",2,ASSISTANT,2026-10-01,\n")
                .andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(2))
                .andExpect(jsonPath("$.failureCount").value(1)).andExpect(jsonPath("$.errors[0].rowNumber").value(3));
        assertThat(assignments.count()).isEqualTo(2);
        upload(HEADER + row).andExpect(status().isOk()).andExpect(jsonPath("$.failureCount").value(1));
        assertThat(assignments.count()).isEqualTo(2);
    }

    @Test
    void reusesClassCurriculumTrainerDateAndRoleValidation() throws Exception {
        String rows = "2," + programSubjectId + ",1,MAIN,2026-10-01,\n"
                + "1,999999,1,MAIN,2026-10-01,\n"
                + "1," + programSubjectId + ",3,MAIN,2026-10-01,\n"
                + "1," + programSubjectId + ",1,MAIN,2026-10-31,2026-10-01\n"
                + "1," + programSubjectId + ",1,OWNER,2026-10-01,\n"
                + "1.5," + programSubjectId + ",1,MAIN,2026-10-01,\n"
                + "1," + programSubjectId + ",1,MAIN,wrong-date,\n";
        upload(HEADER + rows).andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(0))
                .andExpect(jsonPath("$.failureCount").value(7));
        assertThat(assignments.count()).isZero();
    }

    @Test
    void preservesRowNumbersAcrossBlankRowsAndSupportsUtf8Bom() throws Exception {
        upload("\uFEFF" + HEADER + ",,,,,\n1," + programSubjectId + ",1,invalid,2026-10-01,\n")
                .andExpect(status().isOk()).andExpect(jsonPath("$.failureCount").value(1))
                .andExpect(jsonPath("$.errors[0].rowNumber").value(3));
    }

    @Test
    void readsXlsxAndXlsNumericIdsAndExcelDates() throws Exception {
        for (Workbook workbook : new Workbook[]{new XSSFWorkbook(), new HSSFWorkbook()}) {
            assignments.deleteAll();
            try (workbook; var out = new ByteArrayOutputStream()) {
                var sheet = workbook.createSheet("Import");
                var headers = HEADER.trim().split(",");
                var header = sheet.createRow(0);
                for (int col = 0; col < headers.length; col++) header.createCell(col).setCellValue(headers[col]);
                var row = sheet.createRow(1);
                row.createCell(0).setCellValue(1);
                row.createCell(1).setCellValue(programSubjectId);
                row.createCell(2).setCellValue(1);
                row.createCell(3).setCellValue("main");
                var style = workbook.createCellStyle();
                style.setDataFormat(workbook.createDataFormat().getFormat("yyyy-mm-dd"));
                row.createCell(4).setCellValue(LocalDate.of(2026, 10, 1));
                row.getCell(4).setCellStyle(style);
                workbook.write(out);
                String extension = workbook instanceof XSSFWorkbook ? ".xlsx" : ".xls";
                mvc.perform(multipart("/api/teaching-assignments/import")
                        .file(new MockMultipartFile("file", "assignments" + extension, "application/octet-stream", out.toByteArray()))
                        .header("Authorization", bearer)).andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(1));
            }
        }
    }

    @Test
    void rejectsMalformedUnsupportedEmptyAndOversizedRowFilesBeforeWriting() throws Exception {
        for (String content : new String[]{"bad,headers\n1,2", HEADER.replace("Trainer ID", "Class ID"), ""}) {
            upload(content).andExpect(status().isBadRequest());
        }
        upload(HEADER + "\n".repeat(1001)).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/teaching-assignments/import")
                .file(new MockMultipartFile("file", "assignments.txt", "text/plain", HEADER.getBytes(StandardCharsets.UTF_8)))
                .header("Authorization", bearer)).andExpect(status().isBadRequest());
        assertThat(assignments.count()).isZero();
    }

    @Test
    void exportsEveryMatchingPageAndAppliesFiltersAndSort() throws Exception {
        var subject = programSubjects.findById(programSubjectId).orElseThrow();
        for (int number = 0; number < 125; number++) {
            var row = new TeachingAssignment();
            row.setClassId(1L); row.setProgramSubject(subject); row.setTrainerId(1L);
            row.setRole(AssignmentRole.MAIN); row.setEffectiveFrom(LocalDate.of(2026, 1, 1).plusDays(number));
            assignments.save(row);
        }
        var response = mvc.perform(get("/api/teaching-assignments/export").param("format", "CSV")
                .param("page", "99").param("size", "1").param("classId", "1").param("sort", "effectiveFrom,desc")
                .header("Authorization", bearer)).andExpect(status().isOk()).andReturn().getResponse();
        String csv = response.getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv.lines().count()).isEqualTo(126);
        assertThat(csv.lines().skip(1).findFirst().orElseThrow()).contains("2026-05-05");
        var empty = mvc.perform(get("/api/teaching-assignments/export").param("format", "CSV")
                .param("role", "ASSISTANT").header("Authorization", bearer)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(empty.lines().count()).isEqualTo(1);
    }

    @Test
    void downloadsTemplateAndProducesRealExcelCsvAndPdfFiles() throws Exception {
        var template = mvc.perform(get("/api/teaching-assignments/import-template")
                .header("Authorization", bearer)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try (var workbook = WorkbookFactory.create(new ByteArrayInputStream(template))) {
            assertThat(workbook.getSheetAt(0).getRow(0).getPhysicalNumberOfCells()).isEqualTo(13);
            assertThat(workbook.getSheetAt(0).getRow(0).getCell(0).getStringCellValue()).isEqualTo("Class Name");
            assertThat(workbook.getSheet("Existing Assignments").getRow(0).getCell(1).getStringCellValue()).isEqualTo("Program Subject ID");
            assertThat(workbook.getSheet("Classes").getLastRowNum()).isGreaterThanOrEqualTo(1);
            assertThat(workbook.getSheet("Curriculum").getLastRowNum()).isGreaterThanOrEqualTo(3);
            assertThat(workbook.getSheet("Trainers").getLastRowNum()).isGreaterThanOrEqualTo(2);
        }
        upload(HEADER + "1," + programSubjectId + ",1,MAIN,2026-10-01,\n").andExpect(status().isOk());
        for (String format : new String[]{"EXCEL", "CSV", "PDF"}) {
            var response = mvc.perform(get("/api/teaching-assignments/export").param("format", format)
                    .header("Authorization", bearer)).andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("teaching-assignments")))
                    .andReturn().getResponse();
            var bytes = response.getContentAsByteArray();
            if (format.equals("EXCEL")) {
                try (var workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
                    assertThat(workbook.getSheetAt(0).getLastRowNum()).isEqualTo(1);
                }
            } else if (format.equals("PDF")) assertThat(new String(bytes, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
            else assertThat(response.getContentAsString()).contains("MAIN,2026-10-01");
        }
    }

    @Test
    void deniesImportAndExportWithoutAssignmentPermissions() throws Exception {
        bearer = login("student@example.com");
        upload(HEADER + "1," + programSubjectId + ",1,MAIN,2026-10-01,\n").andExpect(status().isForbidden());
        mvc.perform(get("/api/teaching-assignments/export").header("Authorization", bearer)).andExpect(status().isForbidden());
        mvc.perform(get("/api/teaching-assignments/import-template").header("Authorization", bearer)).andExpect(status().isForbidden());
        assertThat(assignments.count()).isZero();
    }

    private ResultActions upload(String content) throws Exception {
        return mvc.perform(multipart("/api/teaching-assignments/import")
                .file(new MockMultipartFile("file", "assignments.csv", "text/csv", content.getBytes(StandardCharsets.UTF_8)))
                .header("Authorization", bearer));
    }

    private String login(String email) throws Exception {
        var body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + mapper.readTree(body).get("accessToken").asText();
    }
}
