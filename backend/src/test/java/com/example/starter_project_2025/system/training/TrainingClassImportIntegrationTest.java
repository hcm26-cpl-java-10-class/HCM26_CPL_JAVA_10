package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// A disposable in-memory database. MockMvc tests roll back; HTTP smoke tests use unique codes.
// No development database or running application is touched.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:h2:mem:class_import_tests;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@Transactional
class TrainingClassImportIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TrainingClassRepository repository;
    @Autowired TrainingClassService service;
    @Autowired RefreshTokenService tokens;
    @Autowired UserDetailsService users;
    @LocalServerPort int port;
    private String token;

    @BeforeEach
    void authenticate() {
        var admin = users.loadUserByUsername("admin@example.com");
        token = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
    }

    private Map<String, Object> row(int number) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", "IMPORT_TEST_" + number);
        row.put("name", "Import test " + number);
        row.put("program", "TEST_PROGRAM");
        row.put("status", "planning");
        row.put("plannedSize", 20);
        row.put("startDate", "2026-06-01");
        row.put("endDate", "2026-12-01");
        row.put("classAdmin", "Test admin");
        row.put("masterTrainer", "Test trainer");
        return row;
    }

    private ResultActions submit(Object rows) throws Exception {
        return mvc.perform(post("/api/classes/import").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(rows)));
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 6})
    void importsAndListsAllValidClasses(int count) throws Exception {
        long before = repository.count();
        var rows = IntStream.rangeClosed(1, count).mapToObj(this::row).toList();
        submit(rows).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(count)))
                .andExpect(jsonPath("$[0].id").isNumber()).andExpect(jsonPath("$[0].status").value("planning"))
                .andExpect(jsonPath("$[0].startDate").value("2026-06-01"));
        assertEquals(before + count, repository.count());
        mvc.perform(get("/api/classes").header("Authorization", "Bearer " + token)
                        .param("search", "IMPORT_TEST_").param("size", "100"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(count)))
                .andExpect(jsonPath("$.content[*].code", containsInAnyOrder(rows.stream().map(r -> r.get("code")).toArray())));
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 6})
    void importsAndListsViaRealHttp(int count) throws Exception {
        String prefix = "HTTP_IMPORT_" + count + "_";
        var rows = IntStream.rangeClosed(1, count).mapToObj(i -> {
            var value = row(i);
            value.put("code", prefix + i);
            return value;
        }).toList();
        try (var client = HttpClient.newHttpClient()) {
            var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/classes/import"))
                    .header("Authorization", "Bearer " + token).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(rows))).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode(), response.body());
            var imported = mapper.readTree(response.body());
            assertEquals(count, imported.size());
            assertTrue(imported.get(0).get("id").isNumber());
            var list = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/classes?search="
                            + URLEncoder.encode(prefix, StandardCharsets.UTF_8) + "&size=100"))
                    .header("Authorization", "Bearer " + token).GET().build();
            var listed = client.send(list, HttpResponse.BodyHandlers.ofString());
            assertEquals(200, listed.statusCode(), listed.body());
            assertEquals(count, mapper.readTree(listed.body()).get("content").size());
            System.out.println("CLASS_IMPORT_HTTP: rows=" + count + ", POST=" + response.statusCode()
                    + ", GET=" + listed.statusCode() + ", listed=" + count);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"code", "name", "program", "status", "plannedSize", "startDate", "endDate", "classAdmin", "masterTrainer"})
    void reportsEachMissingRequiredFieldAndWritesNothing(String field) throws Exception {
        long before = repository.count();
        var invalid = row(2);
        invalid.remove(field);
        submit(List.of(row(1), invalid)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['[1]." + field + "']").isArray());
        assertEquals(before, repository.count());
    }

    @Test
    void reproducesBlankName400WithFieldDetails() throws Exception {
        var invalid = row(1);
        invalid.put("name", "");
        submit(List.of(invalid)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['[0].name']", hasItem("must not be blank")));
    }

    @Test
    void reportsAllInvalidRowsTogether() throws Exception {
        var first = row(1);
        first.put("name", "");
        var second = row(2);
        second.put("program", "");
        submit(List.of(first, second)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['[0].name']").isArray())
                .andExpect(jsonPath("$.errors['[1].program']").isArray());
    }

    @Test
    void rejectsExistingCodeCaseInsensitivelyWithoutPartialImport() throws Exception {
        submit(List.of(row(1))).andExpect(status().isOk());
        long before = repository.count();
        submit(List.of(row(2), row(1))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['[1].code']", hasItem(containsString("already exists"))));
        assertEquals(before, repository.count());
        var dto = mapper.convertValue(row(1), TrainingClassDTO.class);
        dto.setCode(dto.getCode().toLowerCase());
        var error = assertThrows(BusinessValidationException.class, () -> service.importClasses(List.of(dto)));
        assertTrue(error.getErrors().get("[0].code").stream().anyMatch(m -> m.contains("already exists")));
    }

    @Test
    void rejectsDuplicateCodesWithinFile() throws Exception {
        long before = repository.count();
        submit(List.of(row(1), row(1))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['[1].code']", hasItem(containsString("duplicates"))));
        assertEquals(before, repository.count());
    }

    @ParameterizedTest
    @ValueSource(strings = {"active", "assigned", "completed", "closed", "cancelled", "PLANNING"})
    void newClassesMustBePlanning(String status) throws Exception {
        var invalid = row(1);
        invalid.put("status", status);
        submit(List.of(invalid)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors['[0].status']").isArray());
    }

    @ParameterizedTest
    @ValueSource(strings = {"bad code!", "ABC", "abcdefghijklmnopqrstuvwxyzABCDE"})
    void enforcesCodeRules(String code) throws Exception {
        var invalid = row(1);
        invalid.put("code", code);
        submit(List.of(invalid)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors['[0].code']").isArray());
    }

    @ParameterizedTest
    @ValueSource(strings = {"01/06/2026", "46174", "2026-13-01", "2026-02-30"})
    void reportsMalformedDateWithRowAndField(String date) throws Exception {
        var invalid = row(2);
        invalid.put("startDate", date);
        submit(List.of(row(1), invalid)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['[1].startDate']", hasItem(containsString("YYYY-MM-DD"))));
    }

    @Test
    void rejectsEndDateBeforeStartDate() throws Exception {
        var invalid = row(1);
        invalid.put("endDate", "2026-01-01");
        submit(List.of(invalid)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors['[0].endDate']").isArray());
    }

    @Test
    void serviceValidatesDtoEvenWithoutController() {
        var invalid = mapper.convertValue(row(1), TrainingClassDTO.class);
        invalid.setName("");
        var error = assertThrows(BusinessValidationException.class, () -> service.importClasses(List.of(invalid)));
        assertTrue(error.getErrors().containsKey("[0].name"));
    }

    @Test
    void rejectsEmptyListAndNullElement() throws Exception {
        submit(List.of()).andExpect(status().isBadRequest());
        var rows = new ArrayList<Map<String, Object>>();
        rows.add(null);
        submit(rows).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors['[0]']").isArray());
    }

    @Test
    void rejectsObjectWrapperAndMultipart() throws Exception {
        submit(Map.of("classes", List.of(row(1)))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.input").isArray());
        mvc.perform(multipart("/api/classes/import").file("file", new byte[]{1})
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnsupportedMediaType());
    }
}
