package com.example.starter_project_2025.system.subject;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:subject_description_api;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.devtools.restart.enabled=false",
        "logging.level.root=WARN", "logging.level.org.hibernate.SQL=OFF"
})
@AutoConfigureMockMvc
class SubjectDescriptionApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SubjectRepository repository;
    String authorization;

    @BeforeEach void login() throws Exception {
        var response = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        authorization = "Bearer " + json.readTree(response).path("accessToken").asText();
    }

    private String words(int count) { return String.join(" ", Collections.nCopies(count, "programming")); }
    private String uniqueCode() { return "WORD_" + UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT); }
    private String body(String description) throws Exception {
        var values = new LinkedHashMap<String, Object>();
        values.put("code", uniqueCode()); values.put("name", "Description limit");
        values.put("version", "1.0"); values.put("durationHours", 8); values.put("description", description); values.put("isActive", true);
        return json.writeValueAsString(values);
    }
    private Long create(String description) throws Exception {
        var response = mvc.perform(post("/api/subjects").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(body(description)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).path("id").asLong();
    }

    @Test void fiveHundredWordsLongerThanTheOldCharacterLimitPersistUnchanged() throws Exception {
        var description = words(500); assertTrue(description.length() > 1000);
        var id = create(description);
        assertEquals(description, repository.findById(id).orElseThrow().getDescription());
        mvc.perform(get("/api/subjects/" + id).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").value(description));
    }

    @Test void wordFiveHundredAndOneIsRejectedByTheApiWithoutAddingARow() throws Exception {
        long before = repository.count();
        mvc.perform(post("/api/subjects").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(body(words(501))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.description[0]").value(containsString("500 words")));
        assertEquals(before, repository.count());
    }

    @Test void updateUsesTheSameBoundaryAndRejectedUpdatesPreserveExistingData() throws Exception {
        var id = create("Original description");
        mvc.perform(put("/api/subjects/" + id).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("description", words(501)))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.description").isArray());
        assertEquals("Original description", repository.findById(id).orElseThrow().getDescription());
        mvc.perform(put("/api/subjects/" + id).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("description", words(500)))))
                .andExpect(status().isOk());
        assertEquals(words(500), repository.findById(id).orElseThrow().getDescription());
    }

    @Test void unicodeSpacesTabsAndLineBreaksSeparateWordsWithoutChangingTheText() throws Exception {
        String description = " \t\n\uFEFF" + String.join("\u00A0\u202F\n\t", Collections.nCopies(500, "lập_trình")) + " \n";
        assertEquals(500, SubjectDescription.countWords(description));
        var id = create(description);
        assertEquals(description, repository.findById(id).orElseThrow().getDescription());
    }

    @Test void descriptionRemainsOptional() throws Exception {
        assertNull(repository.findById(create(null)).orElseThrow().getDescription());
        assertEquals("", repository.findById(create("")).orElseThrow().getDescription());
    }

    @Test void csvImportReportsTheOversizedRowAndStillCommitsTheValidRow() throws Exception {
        var invalidCode = uniqueCode(); var validCode = uniqueCode();
        var csv = "Code,Name,Version,Duration (Hours),Description\n"
                + invalidCode + ",Invalid,1.0,8," + words(501) + "\n"
                + validCode + ",Valid,1.0,8," + words(500) + "\n";
        var file = new MockMultipartFile("file", "subjects.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));
        assertImportResult(file);
        assertTrue(repository.findByCodeAndVersion(invalidCode, "1.0").isEmpty());
        assertEquals(words(500), repository.findByCodeAndVersion(validCode, "1.0").orElseThrow().getDescription());
    }

    @Test void excelImportCannotBypassTheWordLimit() throws Exception {
        byte[] bytes;
        try (var book = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var sheet = book.createSheet("Subjects");
            var header = sheet.createRow(0);
            var names = List.of("Code", "Name", "Version", "Duration (Hours)", "Description");
            for (int i = 0; i < names.size(); i++) header.createCell(i).setCellValue(names.get(i));
            for (int i = 1; i <= 2; i++) {
                var row = sheet.createRow(i);
                row.createCell(0).setCellValue(uniqueCode()); row.createCell(1).setCellValue("Import words");
                row.createCell(2).setCellValue("1.0"); row.createCell(3).setCellValue(8);
                row.createCell(4).setCellValue(words(i == 1 ? 501 : 500));
            }
            book.write(out); bytes = out.toByteArray();
        }
        assertImportResult(new MockMultipartFile("file", "subjects.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes));
    }

    private void assertImportResult(MockMultipartFile file) throws Exception {
        mvc.perform(multipart("/api/subjects/import").file(file).header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(1))
                .andExpect(jsonPath("$.failureCount").value(1))
                .andExpect(jsonPath("$.errors[0].rowNumber").value(2))
                .andExpect(jsonPath("$.errors[0].message").value(containsString("500 words")));
    }
}
