package com.example.starter_project_2025.system.subject;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:subject_identity_api;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.devtools.restart.enabled=false",
        "logging.level.root=WARN", "logging.level.org.hibernate.SQL=OFF", "debug=false"
})
@AutoConfigureMockMvc
class SubjectIdentityApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SubjectRepository repository;
    @Autowired JdbcTemplate jdbc;
    String authorization;

    @BeforeEach
    void login() throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = json.readTree(response).path("accessToken").asText();
        assertFalse(token.isBlank());
        authorization = "Bearer " + token;
    }

    private String request(String code, String version) throws Exception {
        return json.writeValueAsString(java.util.Map.of("code", code, "version", version,
                "name", "Java identity validation", "durationHours", 40, "isActive", true));
    }

    @Test
    void rejectsScreenshotDuplicateAndOtherCaseSpacingAliasesWithoutAddingRows() throws Exception {
        long count = repository.count();
        for (String[] identity : new String[][] {
                {"java_core", "v1.0"}, {"JAVA_CORE", "1.0"},
                {" Java_Core ", " V1.0 "}, {"JAVA_CORE", "v1.0"}}) {
            mvc.perform(post("/api/subjects").header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON).content(request(identity[0], identity[1])))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().string(containsString("already exists")));
        }
        assertEquals(count, repository.count());
    }

    @Test
    void allowsADifferentVersionAndReturnsNormalizedIdentity() throws Exception {
        mvc.perform(post("/api/subjects").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(request(" java_core ", "v2.0")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("JAVA_CORE"))
                .andExpect(jsonPath("$.version").value("2.0"));
    }

    @Test
    void rejectsAnUpdateCollidingWithAnotherSubject() throws Exception {
        Subject target = repository.saveAndFlush(Subject.builder().code("IDENTITY_UPDATE_TEST")
                .name("Editable subject").version("1.0").durationHours(java.math.BigDecimal.valueOf(8)).build());
        mvc.perform(put("/api/subjects/" + target.getId()).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(request("java_core", "V1.0")))
                .andExpect(status().isBadRequest()).andExpect(content().string(containsString("already exists")));
        assertEquals("IDENTITY_UPDATE_TEST", repository.findById(target.getId()).orElseThrow().getCode());
    }

    @Test
    void updatingTheCurrentSubjectWithTheSameIdentityIsAllowed() throws Exception {
        Subject current = repository.findByCodeAndVersion("JAVA_CORE", "1.0").orElseThrow();
        mvc.perform(put("/api/subjects/" + current.getId()).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(request("java_core", "v1.0")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("JAVA_CORE"))
                .andExpect(jsonPath("$.version").value("1.0"));
    }

    @Test
    void detectsLegacyRowsEvenIfTheyWereNotNormalizedWhenCreated() throws Exception {
        jdbc.update("""
                insert into subjects(code,name,version,duration_hours,is_active,status,created_at,updated_at)
                values (?,?,?,40,true,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                """, " legacy_subject ", "Legacy subject", " V3.0 ");
        mvc.perform(post("/api/subjects").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(request("LEGACY_SUBJECT", "3.0")))
                .andExpect(status().isBadRequest()).andExpect(content().string(containsString("already exists")));
    }

    @Test
    void importCannotBypassTheCanonicalDatabaseConstraint() throws Exception {
        long count = repository.count();
        MockMultipartFile file = new MockMultipartFile("file", "subjects.csv", "text/csv",
                "Code,Name,Version,Duration (Hours)\njava_core,Duplicate Java,v1.0,40\n"
                        .getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/subjects/import").file(file).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.failureCount").value(1))
                .andExpect(jsonPath("$.successCount").value(0))
                .andExpect(jsonPath("$.errors[0].rowNumber").value(2))
                .andExpect(jsonPath("$.errors[0].message").value(containsString("already exists")));
        assertEquals(count, repository.count());
    }

    @Test
    void importRejectsLegacyAndSameFileDuplicatesAndContinuesAfterEachFailure() throws Exception {
        jdbc.update("""
                insert into subjects(code,name,version,duration_hours,is_active,status,created_at,updated_at)
                values (?,?,?,40,false,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                """, " legacy_import ", "Inactive legacy subject", " V4.0 ");
        long count = repository.count();
        MockMultipartFile file = new MockMultipartFile("file", "subjects.csv", "text/csv", ("""
                Code,Name,Version,Duration (Hours)
                LEGACY_IMPORT,Duplicate legacy,4.0,40
                import_unique_subject,First import,v1.0,40
                 IMPORT_UNIQUE_SUBJECT ,Duplicate in file, V1.0 ,40
                IMPORT_AFTER_DUPLICATE,Last import,1.0,8
                """).getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/subjects/import").file(file).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(2))
                .andExpect(jsonPath("$.failureCount").value(2))
                .andExpect(jsonPath("$.errors[0].rowNumber").value(2))
                .andExpect(jsonPath("$.errors[1].rowNumber").value(4))
                .andExpect(jsonPath("$.errors[0].message").value(containsString("already exists")))
                .andExpect(jsonPath("$.errors[1].message").value(containsString("already exists")));
        assertEquals(count + 2, repository.count());
        assertTrue(repository.findByCodeAndVersion("IMPORT_AFTER_DUPLICATE", "1.0").isPresent());
    }

    @Test
    void importValidatesRowsAndDoesNotRollBackValidRows() throws Exception {
        long count = repository.count();
        MockMultipartFile file = new MockMultipartFile("file", "subjects.csv", "text/csv", ("""
                Code,Name,Version,Duration (Hours)
                IMPORT_BAD_DURATION,Invalid duration,1.0,0
                IMPORT_VALID_DURATION,Valid duration,v1.0,4
                """).getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/subjects/import").file(file).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(1))
                .andExpect(jsonPath("$.failureCount").value(1))
                .andExpect(jsonPath("$.errors[0].message").value(containsString("Hours")));
        assertEquals(count + 1, repository.count());
    }

    @Test
    void inactiveSubjectsStillReserveTheirIdentity() throws Exception {
        repository.saveAndFlush(Subject.builder().code("INACTIVE_IDENTITY")
                .name("Inactive subject").version("1.0").durationHours(java.math.BigDecimal.valueOf(8)).isActive(false).build());
        long count = repository.count();
        mvc.perform(post("/api/subjects").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(request(" inactive_identity ", "V1.0")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.code").isArray());
        assertEquals(count, repository.count());
    }

    @Test
    void partialUpdateKeepsIdentityAndBlankUpdateIsRejected() throws Exception {
        Subject target = repository.saveAndFlush(Subject.builder().code("PARTIAL_IDENTITY")
                .name("Before rename").version("1.0").durationHours(java.math.BigDecimal.valueOf(8)).build());
        mvc.perform(put("/api/subjects/" + target.getId()).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"After rename\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("PARTIAL_IDENTITY"))
                .andExpect(jsonPath("$.version").value("1.0"));
        mvc.perform(put("/api/subjects/" + target.getId()).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"   \",\"version\":\"   \"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.code").isArray())
                .andExpect(jsonPath("$.errors.version").isArray());
        assertEquals("PARTIAL_IDENTITY", repository.findById(target.getId()).orElseThrow().getCode());
    }

    @Test
    void concurrentCreatesPersistExactlyOneSubject() throws Exception {
        long count = repository.count();
        CountDownLatch start = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            Callable<org.springframework.mock.web.MockHttpServletResponse> create = () -> {
                assertTrue(start.await(10, TimeUnit.SECONDS));
                return mvc.perform(post("/api/subjects").header("Authorization", authorization)
                                .contentType(MediaType.APPLICATION_JSON).content(request(" concurrent_subject ", "v1.0")))
                        .andReturn().getResponse();
            };
            var first = workers.submit(create);
            var second = workers.submit(create);
            start.countDown();
            var responses = List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
            List<Integer> statuses = responses.stream().map(response -> response.getStatus()).toList();
            assertEquals(1, statuses.stream().filter(code -> code == 200).count());
            assertEquals(1, statuses.stream().filter(code -> code == 400 || code == 409).count());
            var failure = responses.stream().filter(response -> response.getStatus() != 200).findFirst().orElseThrow();
            assertTrue(json.readTree(failure.getContentAsString()).path("errors").has("code"));
            assertFalse(failure.getContentAsString().contains("insert into subjects"));
        }
        assertEquals(count + 1, repository.count());
    }

    @Test
    void excelImportChecksDuplicatesWithNumericCellsAndKeepsDifferentVersions() throws Exception {
        byte[] bytes;
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Subjects");
            var header = sheet.createRow(0);
            String[] headers = {"Code", "Name", "Version", "Duration (Hours)"};
            for (int i = 0; i < headers.length; i++) header.createCell(i).setCellValue(headers[i]);
            for (int i = 1; i <= 3; i++) {
                var row = sheet.createRow(i);
                row.createCell(0).setCellValue(i == 1 ? " excel_identity " : "EXCEL_IDENTITY");
                row.createCell(1).setCellValue("Excel subject");
                row.createCell(2).setCellValue(i == 3 ? "v2.0" : i == 1 ? "v1.0" : "1.0");
                row.createCell(3).setCellValue(40);
            }
            workbook.write(output);
            bytes = output.toByteArray();
        }
        long count = repository.count();
        MockMultipartFile file = new MockMultipartFile("file", "subjects.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);
        mvc.perform(multipart("/api/subjects/import").file(file).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(2))
                .andExpect(jsonPath("$.failureCount").value(1))
                .andExpect(jsonPath("$.errors[0].rowNumber").value(3))
                .andExpect(jsonPath("$.errors[0].message").value(containsString("already exists")));
        assertEquals(count + 2, repository.count());
    }

    @Test
    void updatingOnlyTheVersionCannotCollideWithAnotherSubject() throws Exception {
        repository.saveAndFlush(Subject.builder().code("VERSION_ONLY_UPDATE")
                .name("First version").version("1.0").durationHours(java.math.BigDecimal.valueOf(8)).build());
        Subject target = repository.saveAndFlush(Subject.builder().code("VERSION_ONLY_UPDATE")
                .name("Second version").version("2.0").durationHours(java.math.BigDecimal.valueOf(8)).build());
        mvc.perform(put("/api/subjects/" + target.getId()).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":\" V1.0 \"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.code").isArray());
        assertEquals("2.0", repository.findById(target.getId()).orElseThrow().getVersion());
    }

    @Test
    void sameNameWithADifferentCodeIsAllowed() throws Exception {
        for (String code : List.of("SAME_NAME_ONE", "SAME_NAME_TWO")) {
            mvc.perform(post("/api/subjects").header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON).content(request(code, "v1.0")))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void importPreservesFractionalDurationAndRejectsInvalidNumbers() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "subjects.csv", "text/csv", ("""
                Code,Name,Version,Duration (Hours)
                IMPORT_FRACTION,Fractional duration,1.0,4.5
                IMPORT_WHOLE,Whole duration,1.0,4.0
                IMPORT_INVALID,Invalid duration,1.0,not-a-number
                """).getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/subjects/import").file(file).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(2))
                .andExpect(jsonPath("$.failureCount").value(1))
                .andExpect(jsonPath("$.errors[0].message").value(containsString("valid number")));
        assertEquals(0, repository.findByCodeAndVersion("IMPORT_FRACTION", "1.0").orElseThrow().getDurationHours().compareTo(new java.math.BigDecimal("4.5")));
    }
}
