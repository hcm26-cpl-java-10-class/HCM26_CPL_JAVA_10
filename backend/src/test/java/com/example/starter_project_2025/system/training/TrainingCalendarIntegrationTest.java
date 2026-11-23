package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.demo.session.*;
import com.example.starter_project_2025.exception.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:calendar_tests;DB_CLOSE_DELAY=-1",
    "GOOGLE_CLIENT_ID=test", "GOOGLE_CLIENT_SECRET=test"})
@Transactional
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
class TrainingCalendarIntegrationTest {
    @Autowired TrainingCalendarService service;
    @Autowired TrainingClassService classService;
    @Autowired TrainingClassRepository classes;
    @Autowired SessionRepository sessions;
    @Autowired ObjectMapper mapper;
    @Autowired TrainingCalendarRepository calendars;

    @Test void readsExistingCalendarWithLegacyTopicsAndEmptySchedule() {
        var c = add("LEGACY");
        var calendar = new com.example.starter_project_2025.system.training.entity.TrainingCalendar();
        calendar.setClassId(c.getId()); calendar.setName("Existing calendar"); calendar.setRevision(1);
        calendar.setHistoryChange("Original"); calendar.setModifiedBy("Admin");
        calendar.setClassStartDate(c.getStartDate()); calendar.setActualLearningStartDate(c.getStartDate());
        calendar.setTopicsJson("[]"); calendar.setSchedule(""); calendars.saveAndFlush(calendar);
        var result = service.list(c.getId()).get(1);
        assertEquals("Existing calendar", result.path("name").asText());
        assertTrue(result.path("overviewItems").isArray());
        assertEquals("2026-11-09", result.path("actualLearningStartDate").asText());
    }
    @Autowired org.springframework.test.web.servlet.MockMvc mvc;
    @Autowired com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService tokens;
    @Autowired org.springframework.security.core.userdetails.UserDetailsService users;

    @Test void internalHttpApiCreatesReadsAndExportsTheSameClassCalendar() throws Exception {
        var c = add("HTTP_CAL");
        var admin = users.loadUserByUsername("admin@example.com");
        var token = tokens.generateAccessToken(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
        String path = "/api/classes/" + c.getId() + "/calendars";
        var response = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path)
            .header("Authorization", "Bearer " + token).contentType("application/json").content(body().toString()))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated()).andReturn();
        long id = mapper.readTree(response.getResponse().getContentAsString()).path("id").asLong();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path).header("Authorization", "Bearer " + token))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].classId").value(c.getId()))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[1].name").value("HTTP_CAL_Calendar_1"));
        var export = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path + "/" + id + "/export")
            .header("Authorization", "Bearer " + token))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk()).andReturn();
        try (var workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(export.getResponse().getContentAsByteArray()))) {
            assertEquals("HTTP_CAL_Calendar_1", workbook.getSheetAt(0).getRow(0).getCell(0).getStringCellValue());
        }
    }

    private TrainingClass add(String code) {
        var c = new TrainingClass(); c.setCode(code); c.setName(code); c.setStatus("planning");
        c.setStartDate(LocalDate.of(2026, 11, 9)); c.setEndDate(LocalDate.of(2027, 2, 9)); c.setPlannedSize(20);
        return classes.saveAndFlush(c);
    }
    private com.fasterxml.jackson.databind.JsonNode body() throws Exception {
        return mapper.readTree("""
            {"classStartDate":"2026-11-09","actualLearningStartDate":"2026-11-10","overviewItems":[
              {"id":"java","label":"Java","startDate":"2026-11-10","endDate":"2026-11-12","lessons":[]}]}
            """);
    }
    @Test void emptyClassHasNoFabricatedCalendarAndUnknownClassIs404() {
        var c = add("EMPTY");
        c.setProgram("FR_NFP_JAVA"); c.setMasterTrainer("Actual trainer"); c.setLocation("HCM"); classes.saveAndFlush(c);
        var plan = service.list(c.getId()).getFirst();
        assertEquals("EMPTY_Calendar", plan.path("name").asText());
        assertTrue(plan.path("overviewItems").isArray());
        assertEquals(0, plan.path("overviewItems").size());
        assertEquals("2027-02-09", plan.path("classEndDate").asText());
        assertEquals("", plan.path("actualLearningStartDate").asText());
        c.setEndDate(LocalDate.of(2027,3,1)); classes.saveAndFlush(c);
        assertEquals("2027-03-01", service.list(c.getId()).getFirst().path("classEndDate").asText());
        assertThrows(ResourceNotFoundException.class, () -> service.list(Long.MAX_VALUE));
    }
    @Test void savesReloadsVersionsAndIsolatesClasses() throws Exception {
        var c = add("HCM026"); var other = add("OTHER");
        var saved = service.create(c.getId(), null, body());
        long id = saved.path("id").asLong();
        assertEquals("HCM026_Calendar_1", saved.path("name").asText());
        assertEquals("2026-11-09", saved.path("classStartDate").asText());
        assertEquals("Java", service.list(c.getId()).get(1).path("overviewItems").get(0).path("label").asText());
        assertEquals(other.getId().longValue(), service.list(other.getId()).getFirst().path("classId").asLong());
        assertThrows(ResourceNotFoundException.class, () -> service.create(other.getId(), id, body()));
        service.update(c.getId(), mapper.readTree("{\"updates\":[{\"id\":" + id + ",\"name\":\"Actual calendar\",\"historyChange\":\"Updated\"}]}"));
        assertEquals("Actual calendar", service.list(c.getId()).get(1).path("name").asText());
        var next = service.create(c.getId(), id, body());
        assertNotEquals(id, next.path("id").asLong());
        assertEquals(3, service.list(c.getId()).size());
        var invalid = (com.fasterxml.jackson.databind.node.ObjectNode) body();
        invalid.put("classStartDate", "2026-05-23");
        assertThrows(BadRequestException.class, () -> service.create(c.getId(), null, invalid));
    }
    @Test void liveCalendarTracksRealSessionChangesAndIgnoresCancelledAndDeletedRows() {
        var c = add("LIVE");
        var s = new Session(); s.setClassId(c.getId()); s.setTopicId(1L); s.setTrainerId(1L);
        s.setTitle("Actual lesson"); s.scheduleSlot(LocalDateTime.of(2026,11,10,9,0), LocalDateTime.of(2026,11,10,11,0));
        s.setLocation("A101"); sessions.saveAndFlush(s);
        var live = service.list(c.getId()).getFirst();
        assertEquals(0, live.path("id").asLong());
        assertEquals("Actual lesson", live.path("overviewItems").get(0).path("label").asText());
        s.scheduleSlot(s.getStartTime().plusDays(2), s.getEndTime().plusDays(2)); sessions.saveAndFlush(s);
        assertEquals("2026-11-12", service.list(c.getId()).getFirst().path("actualLearningStartDate").asText());
        s.cancel("Cancelled for live calendar test"); sessions.saveAndFlush(s);
        var afterCancel = service.list(c.getId()).getFirst();
        assertEquals(0, afterCancel.path("overviewItems").size());
        assertEquals("", afterCancel.path("actualLearningStartDate").asText());
        var deleted = Session.builder()
                .classId(c.getId()).topicId(1L).trainerId(1L).title("Deleted lesson")
                .startTime(LocalDateTime.of(2026,11,12,9,0)).endTime(LocalDateTime.of(2026,11,12,11,0))
                .location("A101").status(Session.SessionStatus.SCHEDULED).isActive(false).build();
        sessions.saveAndFlush(deleted);
        assertEquals(0, service.list(c.getId()).getFirst().path("overviewItems").size());
    }

    @Test void updatingClassDatesShiftsOnlyScheduledSessionsAndPreservesCompletedAndCancelled() {
        var c = add("SHIFT_MIXED");
        LocalDateTime scheduledStart = LocalDateTime.of(2026, 11, 10, 9, 0);
        LocalDateTime scheduledEnd = LocalDateTime.of(2026, 11, 10, 11, 0);
        var scheduled = Session.builder()
                .classId(c.getId()).topicId(1L).trainerId(1L).title("Scheduled lesson")
                .startTime(scheduledStart).endTime(scheduledEnd).location("A101")
                .status(Session.SessionStatus.SCHEDULED).build();

        LocalDateTime completedStart = LocalDateTime.of(2026, 11, 11, 9, 0);
        LocalDateTime completedEnd = LocalDateTime.of(2026, 11, 11, 11, 0);
        var completed = Session.builder()
                .classId(c.getId()).topicId(1L).trainerId(1L).title("Completed lesson")
                .startTime(completedStart).endTime(completedEnd).location("A101")
                .status(Session.SessionStatus.COMPLETED).build();

        LocalDateTime cancelledStart = LocalDateTime.of(2026, 11, 12, 9, 0);
        LocalDateTime cancelledEnd = LocalDateTime.of(2026, 11, 12, 11, 0);
        var cancelled = Session.builder()
                .classId(c.getId()).topicId(1L).trainerId(1L).title("Cancelled lesson")
                .startTime(cancelledStart).endTime(cancelledEnd).location("A101")
                .status(Session.SessionStatus.CANCELLED).cancelReason("Holiday").build();

        scheduled = sessions.saveAndFlush(scheduled);
        completed = sessions.saveAndFlush(completed);
        cancelled = sessions.saveAndFlush(cancelled);

        var updateDto = classService.get(c.getId());
        updateDto.setStartDate(LocalDate.of(2026, 12, 1));
        updateDto.setEndDate(LocalDate.of(2027, 3, 1));

        assertDoesNotThrow(() -> classService.update(c.getId(), updateDto));

        var reloadedScheduled = sessions.findById(scheduled.getId()).orElseThrow();
        var reloadedCompleted = sessions.findById(completed.getId()).orElseThrow();
        var reloadedCancelled = sessions.findById(cancelled.getId()).orElseThrow();

        assertEquals(LocalDate.of(2026, 12, 1), reloadedScheduled.getStartTime().toLocalDate());
        assertEquals(Session.SessionStatus.SCHEDULED, reloadedScheduled.getStatus());

        assertEquals(completedStart, reloadedCompleted.getStartTime());
        assertEquals(completedEnd, reloadedCompleted.getEndTime());
        assertEquals(Session.SessionStatus.COMPLETED, reloadedCompleted.getStatus());

        assertEquals(cancelledStart, reloadedCancelled.getStartTime());
        assertEquals(cancelledEnd, reloadedCancelled.getEndTime());
        assertEquals(Session.SessionStatus.CANCELLED, reloadedCancelled.getStatus());
        assertEquals("Holiday", reloadedCancelled.getCancelReason());
    }
}
