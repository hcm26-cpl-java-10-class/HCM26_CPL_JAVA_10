package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.system.subject.technicalgroup.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:subject_technical_group_api;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.devtools.restart.enabled=false",
        "logging.level.root=WARN", "logging.level.org.hibernate.SQL=OFF"
})
@AutoConfigureMockMvc
class SubjectTechnicalGroupApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SubjectTechnicalGroupRepository groups;
    @Autowired SubjectTechnicalGroupService service;
    @Autowired SubjectRepository subjects;
    String authorization;
    static final String PATH = "/api/subjects/technical-groups";

    @BeforeEach void login() throws Exception {
        var response = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        authorization = "Bearer " + json.readTree(response).path("accessToken").asText();
    }
    @AfterEach void clearSecurity() { SecurityContextHolder.clearContext(); }
    private String name() { return "Group " + UUID.randomUUID(); }
    private void authenticate(String authority) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("catalogue-user", "",
                List.of(new SimpleGrantedAuthority(authority))));
    }
    private void create(String name) throws Exception {
        mvc.perform(post(PATH).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", name))))
                .andExpect(status().isCreated());
    }

    @Test void theFormerChoicesAreSeededAndLoadedFromTheBackend() throws Exception {
        mvc.perform(get(PATH).header("Authorization", authorization)).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasItems("Backend", "Frontend", "Database", "DevOps", "Testing", "General")));
    }
    @Test void aNewGroupIsPersistedAndAvailableOnLaterRequests() throws Exception {
        var name = name(); create(name);
        assertTrue(groups.existsByNormalizedName(name.toLowerCase(Locale.ROOT)));
        mvc.perform(get(PATH).header("Authorization", authorization)).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasItem(name)));
    }
    @Test void equivalentCaseAndWhitespaceCannotCreateDuplicateChoices() throws Exception {
        var name = name(); create(name);
        long count = groups.count();
        mvc.perform(post(PATH).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", " \t" + name.toUpperCase(Locale.ROOT).replace(" ", "\u00A0  ") + "\n"))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message", containsString("already exists")));
        assertEquals(count, groups.count());
    }
    @Test void surroundingAndRepeatedWhitespaceAreNormalizedInTheCreatedName() throws Exception {
        var suffix = UUID.randomUUID().toString();
        mvc.perform(post(PATH).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "  Data\u00A0  Science " + suffix + " \n"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Data Science " + suffix));
    }
    @Test void unicodeEquivalentNamesCannotCreateDuplicateChoices() throws Exception {
        var suffix = UUID.randomUUID().toString(); create("Café " + suffix);
        mvc.perform(post(PATH).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Cafe\u0301 " + suffix))))
                .andExpect(status().isConflict());
    }
    @Test void blankOrOverlongNamesAreRejectedWithoutAddingRows() throws Exception {
        long count = groups.count();
        for (var name : List.of("", "\u00A0\uFEFF\t", "a".repeat(101))) {
            mvc.perform(post(PATH).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of("name", name))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.name").isArray());
        }
        assertEquals(count, groups.count());
    }
    @Test void missingNamesAreRejected() throws Exception {
        mvc.perform(post(PATH).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.name").isArray());
    }
    @Test void legacyAndImportedSubjectGroupsRemainVisibleWithoutRewritingSubjects() throws Exception {
        var name = name();
        var saved = subjects.saveAndFlush(Subject.builder().code("GROUP_" + UUID.randomUUID().toString().replace("-", ""))
                .name("Legacy subject").version("1.0").durationHours(8).technicalGroup("  " + name + "  ").build());
        mvc.perform(get(PATH).header("Authorization", authorization)).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasItem(name)));
        assertEquals("  " + name + "  ", subjects.findById(saved.getId()).orElseThrow().getTechnicalGroup());
        mvc.perform(post(PATH).header("Authorization", authorization).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", name))))
                .andExpect(status().isConflict());
    }
    @Test void readPermissionDoesNotGrantPermissionToAddAGroup() {
        authenticate("SUBJECT_READ");
        assertDoesNotThrow(() -> service.list());
        assertThrows(AccessDeniedException.class, () -> service.create(name()));
    }
    @Test void existingSubjectUpdatePermissionCanAddAndReadAGroup() {
        authenticate("SUBJECT_UPDATE");
        var name = name(); assertEquals(name, service.create(name)); assertTrue(service.list().contains(name));
    }
    @Test void anonymousRequestsCannotReadOrCreateGroups() throws Exception {
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Anonymous\"}"))
                .andExpect(status().isUnauthorized());
    }
    @Test void catalogueInitializationIsIdempotent() {
        service.initialize(List.of("Backend", "backend", " General "));
        long count = groups.count();
        service.initialize(List.of("Backend", "backend", " General "));
        assertEquals(count, groups.count());
    }
}
