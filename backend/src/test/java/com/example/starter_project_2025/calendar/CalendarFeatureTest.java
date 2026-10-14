package com.example.starter_project_2025.calendar;

import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.demo.calendar.*;
import com.example.starter_project_2025.system.demo.calendar_version.*;
import com.example.starter_project_2025.system.demo.session.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.MediaType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = CalendarFeatureTest.Config.class, webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {"spring.datasource.url=jdbc:h2:mem:calendar_test;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
                "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false",
                "logging.level.org.hibernate.SQL=OFF"})
class CalendarFeatureTest {
    @Configuration
    @EnableAutoConfiguration(exclude = {SecurityAutoConfiguration.class, UserDetailsServiceAutoConfiguration.class})
    @EntityScan(basePackageClasses = {TrainingCalendar.class, CalendarVersion.class, Session.class})
    @EnableJpaRepositories(basePackageClasses = {CalendarRepository.class, CalendarVersionRepository.class, SessionRepository.class})
    @Import({CalendarServiceImpl.class, CalendarVersionServiceImpl.class, SessionServiceImpl.class,
            CalendarMapperImpl.class, CalendarVersionMapperImpl.class, SessionMapperImpl.class,
            CalendarRules.class, CalendarLock.class, AutoSpecBuilder.class})
    static class Config {}

    @Autowired CalendarService calendars;
    @Autowired CalendarVersionService versions;
    @Autowired SessionService sessions;
    @Autowired SessionRepository sessionRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        jdbc.update("update calendars set active_version_id = null");
        jdbc.update("delete from sessions");
        jdbc.update("delete from calendar_versions");
        jdbc.update("delete from calendars");
        authenticate();
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mvc = MockMvcBuilders.standaloneSetup(new CalendarController(calendars),
                new CalendarVersionController(versions), new SessionController(sessions))
                .setControllerAdvice(new GlobalExceptionHandler()).setValidator(validator).build();
    }

    @AfterEach void clearAuthentication() { SecurityContextHolder.clearContext(); }

    static void authenticate() {
        List<String> permissions = new ArrayList<>();
        for (String resource : List.of("CALENDAR", "CALENDAR_VERSION", "SESSION")) {
            for (String action : List.of("CREATE", "READ", "UPDATE", "DELETE")) permissions.add(resource + "_" + action);
        }
        permissions.add("CALENDAR_VERSION_ACTIVATE");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin", "",
                permissions.stream().map(SimpleGrantedAuthority::new).toList()));
    }

    CalendarDTO calendar(long classId) {
        CalendarDTO dto = new CalendarDTO();
        dto.setClassId(classId);
        dto.setName("Java " + classId);
        dto.setClassStartDate(LocalDate.of(2026, 10, 1));
        dto.setClassEndDate(LocalDate.of(2026, 10, 31));
        return calendars.create(dto);
    }
    CalendarVersionDTO version(Long calendarId) {
        CalendarVersionDTO dto = new CalendarVersionDTO();
        dto.setCalendarId(calendarId);
        dto.setName("Training schedule");
        return versions.create(dto);
    }
    SessionDTO sessionRequest(Long versionId, String start, String end) {
        SessionDTO dto = new SessionDTO();
        dto.setCalendarVersionId(versionId);
        dto.setTopicId(3L);
        dto.setTrainerId(5L);
        dto.setTitle("Spring Boot");
        dto.setStartTime(LocalDateTime.parse(start));
        dto.setEndTime(LocalDateTime.parse(end));
        return dto;
    }
    SessionDTO session(Long versionId) {
        return sessions.create(sessionRequest(versionId, "2026-10-20T08:00", "2026-10-20T11:00"));
    }

    @Test void activateReplacesPreviousVersionAndIsIdempotent() {
        var calendar = calendar(1);
        var v1 = version(calendar.getId());
        var v2 = version(calendar.getId());
        var firstSession = session(v1.getId());
        var secondSession = session(v2.getId());
        assertTrue(calendars.events(calendar.getId(), null, null).isEmpty());
        assertEquals(CalendarVersion.Status.ACTIVE, versions.activate(v1.getId()).getStatus());
        versions.activate(v2.getId());
        var activated = versions.getById(v2.getId());
        assertEquals(CalendarVersion.Status.INACTIVE, versions.getById(v1.getId()).getStatus());
        assertEquals(activated.getPublishedAt(), versions.activate(v2.getId()).getPublishedAt());
        assertEquals(secondSession.getId(), calendars.events(calendar.getId(), null, null).getFirst().getId());
        assertEquals(firstSession.getStatus(), sessions.getById(firstSession.getId()).getStatus());
    }

    @Test void classesHaveIndependentActiveVersionsAndDuplicateCalendarsAreRejected() {
        var a = calendar(1);
        var b = calendar(2);
        var av = version(a.getId());
        var bv = version(b.getId());
        session(av.getId());
        session(bv.getId());
        versions.activate(av.getId());
        versions.activate(bv.getId());
        assertEquals(av.getId(), calendars.getById(a.getId()).getActiveVersionId());
        assertEquals(bv.getId(), calendars.getById(b.getId()).getActiveVersionId());
        assertThrows(ConflictException.class, () -> calendar(1));
    }

    @Test void sessionDatesValidateBoundariesAndPartialUpdates() {
        var version = version(calendar(1).getId());
        assertThrows(BusinessValidationException.class, () -> sessions.create(
                sessionRequest(version.getId(), "2026-09-30T08:00", "2026-10-01T10:00")));
        assertThrows(BusinessValidationException.class, () -> sessions.create(
                sessionRequest(version.getId(), "2026-10-31T23:00", "2026-11-01T01:00")));
        assertThrows(BusinessValidationException.class, () -> sessions.create(
                sessionRequest(version.getId(), "2026-10-10T08:00", "2026-10-10T08:00")));
        var boundary = sessions.create(sessionRequest(version.getId(), "2026-10-31T23:00", "2026-11-01T00:00"));
        SessionDTO update = new SessionDTO();
        update.setEndTime(LocalDateTime.parse("2026-11-01T00:01"));
        assertThrows(BusinessValidationException.class, () -> sessions.update(boundary.getId(), update));
        assertEquals(LocalDateTime.parse("2026-11-01T00:00"), sessions.getById(boundary.getId()).getEndTime());
    }

    @Test void shorteningClassDatesChecksAllVersionsAndRollsBack() {
        var calendar = calendar(1);
        var v = version(calendar.getId());
        session(v.getId());
        CalendarDTO update = new CalendarDTO();
        update.setClassEndDate(LocalDate.of(2026, 10, 15));
        assertThrows(BusinessValidationException.class, () -> calendars.update(calendar.getId(), update));
        assertEquals(LocalDate.of(2026, 10, 31), calendars.getById(calendar.getId()).getClassEndDate());
    }

    @Test void failedActivationPreservesPreviousActiveVersion() {
        var calendar = calendar(1);
        var v1 = version(calendar.getId());
        var v2 = version(calendar.getId());
        session(v1.getId());
        versions.activate(v1.getId());
        assertThrows(BadRequestException.class, () -> versions.activate(v2.getId()));
        var invalid = session(v2.getId());
        jdbc.update("update sessions set end_time = ? where id = ?", LocalDateTime.parse("2026-11-02T10:00"), invalid.getId());
        assertThrows(BusinessValidationException.class, () -> versions.activate(v2.getId()));
        assertEquals(v1.getId(), calendars.getById(calendar.getId()).getActiveVersionId());
        assertNull(versions.getById(v2.getId()).getPublishedAt());
    }

    @Test void publishedVersionCannotBeEditedOrDeletedAndCloneIsIndependent() {
        var v1 = version(calendar(1).getId());
        var s1 = session(v1.getId());
        versions.activate(v1.getId());
        assertThrows(ConflictException.class, () -> versions.update(v1.getId(), new CalendarVersionDTO()));
        assertThrows(ConflictException.class, () -> versions.delete(v1.getId()));
        assertThrows(ConflictException.class, () -> sessions.update(s1.getId(), new SessionDTO()));
        assertThrows(ConflictException.class, () -> sessions.delete(s1.getId()));
        assertThrows(ConflictException.class, () -> session(v1.getId()));
        var v2 = versions.cloneVersion(v1.getId());
        assertEquals(CalendarVersion.Status.DRAFT, v2.getStatus());
        var cloned = sessionRepository.findByCalendarVersionIdOrderByStartTimeAscIdAsc(v2.getId()).getFirst();
        assertNotEquals(s1.getId(), cloned.getId());
        SessionDTO update = new SessionDTO();
        update.setTitle("New title");
        sessions.update(cloned.getId(), update);
        assertEquals("Spring Boot", sessions.getById(s1.getId()).getTitle());
        versions.activate(v2.getId());
        assertEquals(CalendarVersion.Status.INACTIVE, versions.getById(v1.getId()).getStatus());
    }

    @Test void deletingDraftDeletesChildrenAndDoesNotReuseVersionNumber() {
        var c = calendar(1);
        var v = version(c.getId());
        session(v.getId());
        assertThrows(ConflictException.class, () -> calendars.delete(c.getId()));
        versions.delete(v.getId());
        assertEquals(0, sessionRepository.count());
        assertEquals(2, version(c.getId()).getVersionNumber());
    }

    @Test void identifiersAndServerManagedFieldsCannotBeOverwritten() {
        var c = calendar(1);
        var v = version(c.getId());
        var s = session(v.getId());
        assertEquals(c.getClassId(), s.getClassId());
        var request = new SessionDTO();
        request.setId(999L);
        request.setClassId(999L);
        request.setStatus(Session.SessionStatus.COMPLETED);
        request.setCreatedBy(999L);
        request.setIsActive(false);
        var updated = sessions.update(s.getId(), request);
        assertEquals(s.getId(), updated.getId());
        assertEquals(c.getClassId(), updated.getClassId());
        assertEquals(Session.SessionStatus.SCHEDULED, updated.getStatus());
        assertTrue(updated.getIsActive());
        request.setCalendarVersionId(version(c.getId()).getId());
        assertThrows(BusinessValidationException.class, () -> sessions.update(s.getId(), request));
        CalendarDTO update = new CalendarDTO();
        update.setActiveVersionId(v.getId());
        assertNull(calendars.update(c.getId(), update).getActiveVersionId());
    }

    @Test void permissionChecksCoverCustomActions() {
        var v = version(calendar(1).getId());
        var s = session(v.getId());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("reader", "", List.of(new SimpleGrantedAuthority("CALENDAR_VERSION_READ"))));
        assertThrows(AccessDeniedException.class, () -> versions.activate(v.getId()));
        assertThrows(AccessDeniedException.class, () -> versions.cloneVersion(v.getId()));
        assertThrows(AccessDeniedException.class, () -> sessions.cancelSession(s.getId(), new SessionCancelDTO()));
    }

    @Test void cancelRequiresReasonAndPreservesHistoricalVersions() {
        var v1 = version(calendar(1).getId());
        var s1 = session(v1.getId());
        versions.activate(v1.getId());
        assertThrows(BadRequestException.class, () -> sessions.cancelSession(s1.getId(), new SessionCancelDTO()));
        SessionCancelDTO cancel = new SessionCancelDTO();
        cancel.setCancelReason("Trainer unavailable");
        assertEquals(Session.SessionStatus.CANCELLED, sessions.cancelSession(s1.getId(), cancel).getStatus());
        var v2 = versions.cloneVersion(v1.getId());
        var copy = sessionRepository.findByCalendarVersionIdOrderByStartTimeAscIdAsc(v2.getId()).getFirst();
        assertEquals(Session.SessionStatus.CANCELLED, copy.getStatus());
        versions.activate(v2.getId());
        assertThrows(ConflictException.class, () -> sessions.cancelSession(s1.getId(), cancel));
    }

    @Test void eventsUseOverlapAndVersionFilterWorks() {
        var c = calendar(1);
        var v = version(c.getId());
        session(v.getId());
        versions.activate(v.getId());
        assertEquals(1, calendars.events(c.getId(), LocalDateTime.parse("2026-10-20T09:00"),
                LocalDateTime.parse("2026-10-20T10:00")).size());
        assertTrue(calendars.events(c.getId(), LocalDateTime.parse("2026-10-20T11:00"), null).isEmpty());
        SessionFilter filter = new SessionFilter();
        filter.setCalendarVersionId(v.getId());
        assertEquals(1, sessions.getAll(Pageable.unpaged(), null, filter).getTotalElements());
    }

    @Test void concurrentActivationsSerializeAndKeepOneActive() throws Exception {
        var c = calendar(1);
        var a = version(c.getId());
        var b = version(c.getId());
        session(a.getId());
        session(b.getId());
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            List<Future<?>> tasks = new ArrayList<>();
            for (Long id : List.of(a.getId(), b.getId())) {
                tasks.add(pool.submit(() -> {
                    authenticate();
                    try {
                        if (!start.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                        versions.activate(id);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException(e);
                    } finally { SecurityContextHolder.clearContext(); }
                }));
            }
            start.countDown();
            for (Future<?> task : tasks) task.get(15, TimeUnit.SECONDS);
        }
        long activeCount = List.of(versions.getById(a.getId()), versions.getById(b.getId())).stream()
                .filter(v -> v.getStatus() == CalendarVersion.Status.ACTIVE).count();
        assertEquals(1, activeCount);
    }

    @Test void activationAndDateChangeCannotCommitAnInvalidSchedule() throws Exception {
        var c = calendar(1);
        var v = version(c.getId());
        session(v.getId());
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<?> activation = pool.submit(() -> {
                authenticate();
                try {
                    new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
                        versions.activate(v.getId());
                        locked.countDown();
                        try {
                            if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Release timeout");
                        } catch (InterruptedException e) { throw new RuntimeException(e); }
                    });
                } finally { SecurityContextHolder.clearContext(); }
            });
            assertTrue(locked.await(5, TimeUnit.SECONDS));
            Future<?> change = pool.submit(() -> {
                authenticate();
                try {
                    CalendarDTO update = new CalendarDTO();
                    update.setClassEndDate(LocalDate.of(2026, 10, 10));
                    assertThrows(BusinessValidationException.class, () -> calendars.update(c.getId(), update));
                } finally { SecurityContextHolder.clearContext(); }
            });
            release.countDown();
            activation.get(15, TimeUnit.SECONDS);
            change.get(15, TimeUnit.SECONDS);
        }
        assertEquals(v.getId(), calendars.getById(c.getId()).getActiveVersionId());
        assertEquals(LocalDate.of(2026, 10, 31), calendars.getById(c.getId()).getClassEndDate());
    }

    @Test void httpCrudValidatesRequestsAndDoesNotExposeGenericImport() throws Exception {
        mvc.perform(post("/api/calendars").contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"classId":1,"name":"Java","classStartDate":"2026-10-01","classEndDate":"2026-10-31",
                     "activeVersionId":999,"id":999}
                    """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activeVersionId").isEmpty());
        mvc.perform(post("/api/calendars").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON)
                .content(""" 
                    {"topicId":1,"trainerId":1,"title":"Java","startTime":"2026-10-20T08:00:00","endTime":"2026-10-20T09:00:00"}
                    """)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/sessions/import")).andExpect(status().isMethodNotAllowed());
        var c = calendars.getAll(Pageable.unpaged(), null, new CalendarFilter()).getContent().getFirst();
        var v = version(c.getId());
        mvc.perform(post("/api/calendar-versions/" + v.getId() + "/activate"))
                .andExpect(status().isBadRequest());
        session(v.getId());
        mvc.perform(post("/api/calendar-versions/" + v.getId() + "/activate"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(put("/api/calendar-versions/" + v.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Edited\"}")).andExpect(status().isConflict());
    }

    @Test void databaseConstraintsRejectInvalidReferencesAndDuplicateNumbers() {
        var c = calendar(1);
        var v = version(c.getId());
        var s = session(v.getId());
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("update sessions set calendar_version_id = 99999 where id = ?", s.getId()));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("update calendars set active_version_id = 99999 where id = ?", c.getId()));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("update sessions set end_time = start_time where id = ?", s.getId()));
        var v2 = version(c.getId());
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("update calendar_versions set version_number = ? where id = ?", v.getVersionNumber(), v2.getId()));
    }
}
