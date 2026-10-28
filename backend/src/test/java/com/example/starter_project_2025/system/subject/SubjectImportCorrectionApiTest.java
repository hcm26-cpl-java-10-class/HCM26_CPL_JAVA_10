package com.example.starter_project_2025.system.subject;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:subject_import_correction;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.devtools.restart.enabled=false",
        "logging.level.root=WARN", "logging.level.org.hibernate.SQL=OFF"
})
@AutoConfigureMockMvc
class SubjectImportCorrectionApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SubjectRepository subjects;
    @Autowired SubjectImportService service;
    String bearer;

    @BeforeEach void login() throws Exception {
        var response = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        bearer = "Bearer " + json.readTree(response).path("accessToken").asText();
    }
    @AfterEach void clearAuthentication() { SecurityContextHolder.clearContext(); }
    String code() { return "EDIT_" + UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT); }
    Map<String, String> values(String code, String hours) {
        return new LinkedHashMap<>(Map.of("Code", code, "Name", "Corrected subject", "Version", "1.0", "Hours", hours));
    }
    Map<String, Object> row(int number, Map<String, String> values) { return Map.of("rowNumber", number, "values", values); }
    org.springframework.test.web.servlet.ResultActions send(String path, List<Map<String, Object>> rows) throws Exception {
        return mvc.perform(post("/api/subjects/import/" + path).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("rows", rows))));
    }

    @Test void failedFileRowsExposeOriginalEditableValuesEvenWhenParsingFails() throws Exception {
        String code = code(); long count = subjects.count();
        var file = new MockMultipartFile("file", "subjects.csv", "text/csv",
                ("code,name,version,Duration (Hours),Outline\n" + code + ",Bad hours,1.0,-x,Keep this outline\n").getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/subjects/import/preview").file(file).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.invalidRows").value(1))
                .andExpect(jsonPath("$.rows[0].values.Code").value(code))
                .andExpect(jsonPath("$.rows[0].values.Hours").value("-x"))
                .andExpect(jsonPath("$.rows[0].values.Outline").value("Keep this outline"));
        assertEquals(count, subjects.count());
    }
    @Test void correctedRowsCanBeRecheckedWithoutWritingAndThenSaved() throws Exception {
        String code = code(); long count = subjects.count(); var values = values(code, "-4");
        send("preview-rows", List.of(row(9, values))).andExpect(status().isOk())
                .andExpect(jsonPath("$.invalidRows").value(1)).andExpect(jsonPath("$.rows[0].rowNumber").value(9));
        values.put("Hours", "8"); values.put("Objectives", "Learn OOP"); values.put("Status", "inactive");
        send("preview-rows", List.of(row(9, values))).andExpect(status().isOk()).andExpect(jsonPath("$.validRows").value(1));
        assertEquals(count, subjects.count());
        send("rows", List.of(row(9, values))).andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(1));
        var saved = subjects.findByCodeAndVersion(code, "1.0").orElseThrow();
        assertEquals(8, saved.getDurationHours()); assertEquals("Learn OOP", saved.getObjectives()); assertFalse(saved.getIsActive());
    }
    @Test void duplicatesCreatedByInlineEditsAreReportedAndCanBeCorrected() throws Exception {
        String code = code(); var first = values(code, "4"); var second = values(code.toLowerCase(Locale.ROOT), "4");
        second.put("Version", "v1.0");
        send("preview-rows", List.of(row(2, first), row(3, second))).andExpect(status().isOk())
                .andExpect(jsonPath("$.validRows").value(1)).andExpect(jsonPath("$.rows[1].valid").value(false));
        second.put("Version", "2.0");
        send("preview-rows", List.of(row(2, first), row(3, second))).andExpect(status().isOk()).andExpect(jsonPath("$.validRows").value(2));
        assertTrue(subjects.findByCodeAndVersion(code, "1.0").isEmpty());
    }
    @Test void saveRevalidatesFractionalHoursLongDescriptionsAndInvalidModes() throws Exception {
        var fractional = values(code(), "1.5");
        var longDescription = values(code(), "4"); longDescription.put("Description", String.join(" ", Collections.nCopies(501, "word")));
        var invalidMode = values(code(), "4"); invalidMode.put("Delivery Mode", "OTHER");
        long count = subjects.count();
        send("rows", List.of(row(2, fractional), row(3, longDescription), row(4, invalidMode))).andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(0)).andExpect(jsonPath("$.failureCount").value(3));
        assertEquals(count, subjects.count());
    }
    @Test void partialImportCanRetryOnlyFailedOriginalRowNumbers() throws Exception {
        String first = code(), second = code(); var failed = values(second, "0");
        send("rows", List.of(row(4, values(first, "4")), row(12, failed))).andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(1)).andExpect(jsonPath("$.errors[0].rowNumber").value(12));
        long count = subjects.count(); failed.put("Hours", "6");
        send("rows", List.of(row(12, failed))).andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(1)).andExpect(jsonPath("$.failureCount").value(0));
        assertEquals(count + 1, subjects.count());
        assertEquals(4, subjects.findByCodeAndVersion(first, "1.0").orElseThrow().getDurationHours());
    }
    @Test void aDuplicateInsertedAfterRecheckIsRejectedAtSaveTime() throws Exception {
        String code = code(); var rows = List.of(row(7, values(code, "4")));
        send("preview-rows", rows).andExpect(status().isOk()).andExpect(jsonPath("$.validRows").value(1));
        subjects.saveAndFlush(Subject.builder().code(code).name("Already created elsewhere").version("1.0").durationHours(20).build());
        send("rows", rows).andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(0)).andExpect(jsonPath("$.failureCount").value(1));
        assertEquals(20, subjects.findByCodeAndVersion(code, "1.0").orElseThrow().getDurationHours());
    }
    @Test void malformedAndDuplicateRowNumbersAreRejectedBeforeAnyWrites() throws Exception {
        long count = subjects.count();
        for (String path : List.of("preview-rows", "rows")) {
            send(path, List.of()).andExpect(status().isBadRequest());
            send(path, List.of(row(1, values(code(), "4")))).andExpect(status().isBadRequest());
            send(path, List.of(row(2, values(code(), "4")), row(2, values(code(), "4")))).andExpect(status().isBadRequest());
            send(path, List.of(row(2, Map.of()))).andExpect(status().isBadRequest());
        }
        assertEquals(count, subjects.count());
    }
    @Test void editedTextCanBeClearedAndRequiredFieldsAreStillValidated() throws Exception {
        var values = values(code(), "4"); values.put("Name", " "); values.put("Outline", "");
        send("preview-rows", List.of(row(2, values))).andExpect(status().isOk())
                .andExpect(jsonPath("$.invalidRows").value(1)).andExpect(jsonPath("$.rows[0].values.Name").value(" "));
        values.put("Name", "Corrected");
        send("rows", List.of(row(2, values))).andExpect(status().isOk()).andExpect(jsonPath("$.successCount").value(1));
    }
    @Test void editedEndpointsRequireCreatePermissionAndAuthentication() throws Exception {
        var input = new SubjectImportRowsRequest(List.of(new SubjectImportRowsRequest.Row(2, values(code(), "4"))));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("reader", "n/a", List.of(new SimpleGrantedAuthority("SUBJECT_READ"))));
        assertThrows(AccessDeniedException.class, () -> service.previewRows(input));
        assertThrows(AccessDeniedException.class, () -> service.importRows(input));
        SecurityContextHolder.clearContext();
        mvc.perform(post("/api/subjects/import/rows").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isUnauthorized());
    }
}
