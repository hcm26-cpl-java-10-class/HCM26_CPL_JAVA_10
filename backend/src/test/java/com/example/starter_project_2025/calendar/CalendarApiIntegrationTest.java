package com.example.starter_project_2025.calendar;

import com.example.starter_project_2025.StarterProject2025Application;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Full application, H2 persistence and real JWT filter; no mocked services or authentication. */
@SpringBootTest(classes = StarterProject2025Application.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:calendar_api_test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=OFF",
        "app.seed.admin.email=calendar-admin@example.com",
        "app.seed.admin.password=calendar-test-password"
})
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CalendarApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired com.example.starter_project_2025.system.demo.course.CourseRepository courses;
    @Autowired com.example.starter_project_2025.system.demo.online_lession.LessonRepository lessons;
    @Autowired com.example.starter_project_2025.system.rbac.user.UserRepository users;
    private Long topicId;
    private Long trainerId;
    private String adminToken;
    private String studentToken;
    private final AtomicLong classIds = new AtomicLong(800000);

    @BeforeAll
    void loginWithSeededAccounts() throws Exception {
        var course = courses.save(com.example.starter_project_2025.system.demo.course.Course.builder()
                .name("Calendar API test course").build());
        topicId = lessons.save(com.example.starter_project_2025.system.demo.online_lession.Lesson.builder()
                .course(course).title("Spring Boot").orderIndex(1).build()).getId();
        trainerId = users.findByEmail("calendar-admin@example.com").orElseThrow().getId();
        adminToken = login("calendar-admin@example.com", "calendar-test-password");
        studentToken = login("student@example.com", "password123");
    }

    private String login(String email, String password) throws Exception {
        return read(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", email).put("password", password).toString()))
                .andExpect(status().isOk())).path("accessToken").asText();
    }

    private ResultActions admin(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + adminToken));
    }

    private JsonNode read(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private JsonNode calendar() throws Exception {
        return read(admin(post("/api/calendars").contentType(MediaType.APPLICATION_JSON).content("""
                {"classId":%d,"name":"Postman Java","description":"Calendar API test",
                 "classStartDate":"2026-10-01","classEndDate":"2026-10-31"}
                """.formatted(classIds.incrementAndGet()))).andExpect(status().isOk()));
    }

    private JsonNode version(long calendarId) throws Exception {
        return read(admin(post("/api/calendar-versions").contentType(MediaType.APPLICATION_JSON)
                .content("{\"calendarId\":" + calendarId + ",\"name\":\"Draft schedule\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT")));
    }

    private JsonNode session(long versionId) throws Exception {
        return read(admin(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content("""
                {"calendarVersionId":%d,"topicId":%d,"trainerId":%d,"title":"Spring Boot",
                 "forceOverride":true,"overrideReason":"Independent calendar fixture",
                 "startTime":"2026-10-20T08:00:00","endTime":"2026-10-20T11:00:00"}
                """.formatted(versionId, topicId, trainerId))).andExpect(status().isCreated()));
    }

    @Test
    void calendarCrudSearchPaginationAndValidation() throws Exception {
        JsonNode c = calendar();
        long id = c.path("id").asLong();
        admin(get("/api/calendars/search").param("classId", c.path("classId").asText())
                .param("search", "Postman").param("page", "0").param("size", "1").param("sort", "id,desc"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(id));
        admin(get("/api/calendars/{id}", id)).andExpect(status().isOk());
        admin(get("/api/calendars/{id}/events", id)).andExpect(status().isOk())
                .andExpect(content().json("[]"));
        admin(put("/api/calendars/{id}", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Updated calendar\",\"activeVersionId\":999}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Updated calendar"))
                .andExpect(jsonPath("$.activeVersionId").isEmpty());
        admin(put("/api/calendars/{id}", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"classEndDate\":\"2026-09-01\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.classEndDate").exists());
        admin(post("/api/calendars").contentType(MediaType.APPLICATION_JSON).content(c.toString()))
                .andExpect(status().isConflict());
        admin(delete("/api/calendars/{id}", id)).andExpect(status().isNoContent());
        admin(get("/api/calendars/{id}", id)).andExpect(status().isNotFound());
    }

    @Test
    void draftCrudCascadesSessionsAndNeverReusesVersionNumbers() throws Exception {
        long cid = calendar().path("id").asLong();
        long vid = version(cid).path("id").asLong();
        long sid = session(vid).path("id").asLong();
        admin(get("/api/calendar-versions").param("calendarId", "" + cid).param("search", "Draft"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        admin(get("/api/calendar-versions/{id}", vid)).andExpect(status().isOk());
        admin(put("/api/calendar-versions/{id}", vid).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Updated draft\",\"status\":\"ACTIVE\",\"versionNumber\":999}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.versionNumber").value(1));
        admin(get("/api/sessions").param("calendarVersionId", "" + vid).param("sort", "startTime,asc"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(sid));
        admin(get("/api/sessions/{id}", sid)).andExpect(status().isOk());
        admin(put("/api/sessions/{id}", sid).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Edited session\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Edited session"));
        admin(delete("/api/sessions/{id}", sid)).andExpect(status().isNoContent());
        long child = session(vid).path("id").asLong();
        admin(delete("/api/calendars/{id}", cid)).andExpect(status().isConflict());
        admin(delete("/api/calendar-versions/{id}", vid)).andExpect(status().isNoContent());
        admin(get("/api/sessions/{id}", child)).andExpect(status().isNotFound());
        assertEquals(2, version(cid).path("versionNumber").asInt());
    }

    @Test
    void publicationCloneEventsAndCancellationWorkflow() throws Exception {
        long cid = calendar().path("id").asLong();
        long v1 = version(cid).path("id").asLong();
        admin(post("/api/calendar-versions/{id}/activate", v1)).andExpect(status().isBadRequest());
        long sid = session(v1).path("id").asLong();
        admin(post("/api/calendar-versions/{id}/activate", v1))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        // Compare persisted timestamps: H2 stores microseconds, while the first response may contain nanoseconds.
        JsonNode active = read(admin(get("/api/calendar-versions/{id}", v1)).andExpect(status().isOk()));
        admin(post("/api/calendar-versions/{id}/activate", v1)).andExpect(status().isOk())
                .andExpect(jsonPath("$.publishedAt").value(active.path("publishedAt").asText()));
        admin(get("/api/calendars/{id}/events", cid)
                .param("from", "2026-10-20T09:00:00").param("to", "2026-10-20T10:00:00"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(sid));
        admin(get("/api/calendars/{id}/events", cid).param("from", "2026-10-20T11:00:00"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        admin(get("/api/calendars/{id}/events", cid)
                .param("from", "2026-10-20T11:00:00").param("to", "2026-10-20T08:00:00"))
                .andExpect(status().isBadRequest());
        admin(put("/api/calendar-versions/{id}", v1).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Forbidden edit\"}")).andExpect(status().isConflict());
        admin(delete("/api/calendar-versions/{id}", v1)).andExpect(status().isConflict());
        JsonNode clone = read(admin(post("/api/calendar-versions/{id}/clone", v1))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("DRAFT")));
        long v2 = clone.path("id").asLong();
        JsonNode copies = read(admin(get("/api/sessions").param("calendarVersionId", "" + v2))
                .andExpect(status().isOk()));
        long copyId = copies.path("content").get(0).path("id").asLong();
        assertNotEquals(sid, copyId);
        admin(put("/api/sessions/{id}", copyId).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Cloned session\"}")).andExpect(status().isOk());
        admin(get("/api/sessions/{id}", sid)).andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Spring Boot"));
        admin(post("/api/calendar-versions/{id}/activate", v2)).andExpect(status().isOk());
        admin(get("/api/calendar-versions/{id}", v1)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INACTIVE"));
        admin(patch("/api/sessions/{id}/cancel", sid).contentType(MediaType.APPLICATION_JSON)
                .content("{\"cancelReason\":\"Historical version\"}")).andExpect(status().isConflict());
        admin(patch("/api/sessions/{id}/cancel", copyId).contentType(MediaType.APPLICATION_JSON)
                .content("{\"cancelReason\":\"Trainer unavailable\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        admin(get("/api/calendars/{id}/events", cid)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("CANCELLED"));
    }

    @ParameterizedTest
    @CsvSource({"/api/calendars", "/api/calendar-versions", "/api/sessions"})
    void authenticationAndAuthorizationAreEnforced(String path) throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(path).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void nestedVersionsAndCalendarLifecycleShareCountersAndSessionData() throws Exception {
        long cid = calendar().path("id").asLong();
        long v1 = version(cid).path("id").asLong();
        long sid = session(v1).path("id").asLong();
        admin(post("/api/calendar-versions/{id}/activate", v1)).andExpect(status().isOk());
        admin(get("/api/v1/sessions/{id}", sid)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
        admin(post("/api/v1/sessions/{id}/cancel", sid).contentType(MediaType.APPLICATION_JSON)
                .content("{\"cancelReason\":\"Unavailable\"}"))
                .andExpect(status().isOk())
                .andExpect(header().exists("ETag"))
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        JsonNode copied = read(admin(post("/api/calendars/{id}/versions", cid)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"COPY_ACTIVE\",\"name\":\"New schedule\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNumber").value(2)));
        long copyId = copied.path("id").asLong();
        admin(get("/api/sessions").param("calendarVersionId", "" + copyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].topicId").value(topicId))
                .andExpect(jsonPath("$.content[0].status").value("SCHEDULED"));
        // The new COPY_ACTIVE action resets operations; the retained clone action preserves history.
        admin(post("/api/calendar-versions/{id}/clone", v1))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNumber").value(3));
        admin(delete("/api/calendars/{cid}/versions/{vid}", cid, copyId))
                .andExpect(status().isNoContent());
        admin(post("/api/calendar-versions/{id}/activate", copyId)).andExpect(status().isNotFound());
        assertEquals(4, version(cid).path("versionNumber").asInt());
        admin(get("/api/calendars")).andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
    }

    @ParameterizedTest
    @CsvSource({"/api/calendars", "/api/calendar-versions", "/api/sessions"})
    void missingRequiredFieldsReturnValidationErrors(String path) throws Exception {
        admin(post(path).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isMap());
    }

    @ParameterizedTest
    @CsvSource({"/api/calendars", "/api/calendar-versions", "/api/sessions"})
    void unsupportedImportReturnsMethodNotAllowed(String path) throws Exception {
        admin(post(path + "/import")).andExpect(status().isMethodNotAllowed());
    }
}
