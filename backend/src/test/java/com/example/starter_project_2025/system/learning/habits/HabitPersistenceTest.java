package com.example.starter_project_2025.system.learning.habits;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static com.example.starter_project_2025.system.learning.habits.HabitDtos.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.http.HttpStatus.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DataJpaTest(showSql = false, properties = {
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "app.learning.habits.zone=Asia/Ho_Chi_Minh"
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import({HabitPolicy.class, HabitGoals.class, HabitSessions.class, HabitObjectives.class,
    HabitStatistics.class, HabitController.class, HabitPersistenceTest.Config.class})
class HabitPersistenceTest {
    @TestConfiguration
    @EnableMethodSecurity
    static class Config {
        @Bean MutableClock habitTestClock() { return new MutableClock(); }
    }

    static class MutableClock extends Clock {
        volatile Instant time = Instant.EPOCH;
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return Clock.fixed(time, zone); }
        @Override public Instant instant() { return time; }
    }

    @Autowired MutableClock clock;
    @Autowired UserRepository users;
    @Autowired HabitGoals goals;
    @Autowired HabitSessions sessions;
    @Autowired HabitObjectives objectives;
    @Autowired HabitStatistics statistics;
    @Autowired HabitController controller;
    User alice;
    User bob;

    @BeforeEach void setup() {
        clock.time = Instant.parse("2026-11-27T04:00:00Z");
        alice = user();
        bob = user();
    }

    @AfterEach void clearSecurity() { SecurityContextHolder.clearContext(); }

    @Test void goalsAndRealStudyRecordsKeepHistoricalTargetsAndRecalculate() {
        Long owner = alice.getId();
        assertNull(statistics.summary(owner, null, null).weeklyGoal());
        assertEquals(0, statistics.summary(owner, null, null).longestStreak());
        Goal weekly = goals.save(owner, null, goal(GoalPeriod.WEEKLY, 180, "2026-11-23", null));
        goals.save(owner, null, goal(GoalPeriod.MONTHLY, 720, "2026-11-01", null));
        assertEquals(CONFLICT, assertThrows(ResponseStatusException.class, () ->
            goals.save(owner, null, goal(GoalPeriod.WEEKLY, 100, "2026-11-23", null))).getStatusCode());
        log(owner, "2026-11-25", 45, "Reading");
        log(owner, "2026-11-26", 30, "Practice");
        log(owner, "2026-11-27", 60, "Exercises");
        Statistics initial = statistics.summary(owner, null, null);
        assertEquals(135 * 60, initial.weekSeconds());
        assertEquals(75, initial.weeklyGoal().percentage());
        assertEquals(45 * 60, initial.weeklyGoal().remainingSeconds());
        assertEquals(135 * 60, initial.monthlyGoal().actualSeconds());
        assertEquals(3, initial.currentStreak());
        assertEquals(3, initial.activeDays());

        Session extra = log(owner, "2026-11-27", 45, "Revision");
        Statistics reached = statistics.summary(owner, null, null);
        assertEquals(100, reached.weeklyGoal().percentage());
        assertEquals(0, reached.weeklyGoal().remainingSeconds());
        assertEquals(3, reached.currentStreak());
        assertEquals(3, reached.activeDays());

        clock.time = Instant.parse("2026-11-28T04:00:00Z");
        assertEquals(3, statistics.summary(owner, null, null).currentStreak());
        clock.time = Instant.parse("2026-11-30T04:00:00Z");
        assertEquals(0, statistics.summary(owner, null, null).currentStreak());
        Goal changed = goals.save(owner, weekly.id(), goal(GoalPeriod.WEEKLY, 240, "2026-11-23", weekly.version()));
        assertEquals(240, statistics.summary(owner, null, null).weeklyGoal().targetMinutes());
        var previous = statistics.history(owner, date("2026-11-23"), date("2026-11-29"), GoalPeriod.WEEKLY);
        assertEquals(180, previous.getFirst().targetMinutes());
        assertEquals(100, previous.getFirst().percentage());
        Goal archived = goals.archive(owner, changed.id(), changed.version());
        assertEquals("ARCHIVED", archived.status());

        Session edited = sessions.edit(owner, extra.id(), false,
            new StudyInput(null, null, "Updated revision", null, date("2026-11-27"), 60, extra.version()));
        assertTrue(statistics.history(owner, date("2026-11-23"), date("2026-11-29"), GoalPeriod.WEEKLY)
            .getFirst().percentage() > 100);
        sessions.delete(owner, edited.id(), edited.version());
        assertEquals(75, statistics.history(owner, date("2026-11-23"), date("2026-11-29"), GoalPeriod.WEEKLY)
            .getFirst().percentage());
        assertEquals(3, statistics.summary(owner, null, null).longestStreak());
        assertEquals(135 * 60, statistics.summary(owner, null, null).totalSeconds());
    }

    @Test void reportUsesHistoricalTargetsAndDailySessionsWithClippedPeriodStreak() {
        Long owner = alice.getId();
        clock.time = Instant.parse("2026-11-02T04:00:00Z");
        var original = goals.save(owner, null, goal(GoalPeriod.WEEKLY, 180, "2026-11-02", null));
        clock.time = Instant.parse("2026-11-30T04:00:00Z");
        goals.save(owner, original.id(), goal(GoalPeriod.WEEKLY, 300, "2026-11-02", original.version()));
        log(owner, "2026-11-08", 180, "Week one");
        log(owner, "2026-11-15", 120, "Week two");
        log(owner, "2026-11-22", 180, "Week three");
        log(owner, "2026-11-28", 75, "Week four");
        log(owner, "2026-11-29", 75, "Week four review");
        var report = statistics.report(owner, date("2026-11-02"), date("2026-11-29"), false);
        assertEquals(43200L, report.plannedSeconds());
        assertEquals(37800, report.actualSeconds());
        assertEquals(87.5, report.achievement());
        assertEquals(5400L, report.remainingSeconds());
        assertEquals(5, report.activeDays());
        assertEquals(2, report.currentStreak());
        assertEquals(2, report.longestStreak());
        assertEquals(28, report.coveredDays());
    }

    @Test void timerPersistsAcrossTransactionsAndSplitsSundayMidnightWithoutPauses() {
        Long owner = alice.getId();
        clock.time = Instant.parse("2026-11-29T16:50:00Z");
        TimerInput request = new TimerInput(UUID.randomUUID(), null, null);
        Session started = sessions.start(owner, false, request);
        assertEquals(started.id(), sessions.start(owner, false, request).id());
        assertEquals(started.id(), sessions.active(owner).id());
        assertEquals(CONFLICT, assertThrows(ResponseStatusException.class, () ->
            sessions.start(owner, false, new TimerInput(UUID.randomUUID(), null, null))).getStatusCode());
        clock.time = Instant.parse("2026-11-29T16:55:00Z");
        Session paused = sessions.transition(owner, started.id(), started.version(), HabitSessions.Action.PAUSE);
        clock.time = Instant.parse("2026-11-29T16:58:00Z");
        assertEquals(300, sessions.active(owner).elapsedSeconds());
        Session running = sessions.transition(owner, paused.id(), paused.version(), HabitSessions.Action.RESUME);
        clock.time = Instant.parse("2026-11-29T17:17:00Z");
        Session complete = sessions.transition(owner, running.id(), running.version(), HabitSessions.Action.FINISH);
        assertEquals(1440, complete.elapsedSeconds());
        assertEquals(complete.id(), sessions.transition(owner, running.id(), running.version(), HabitSessions.Action.FINISH).id());
        assertNull(sessions.active(owner));
        assertEquals(1, sessions.history(owner, null, date("2026-11-01"), date("2026-11-30"), 0, 1).items().size());
        var days = statistics.activity(owner, date("2026-11-29"), date("2026-11-30"));
        assertEquals(420, days.getFirst().seconds());
        assertFalse(days.getFirst().active());
        assertEquals(1020, days.getLast().seconds());
        assertTrue(days.getLast().active());
        assertEquals(1020, statistics.summary(owner, null, null).weekSeconds());

        var cancel = sessions.start(owner, false, new TimerInput(UUID.randomUUID(), null, null));
        clock.time = clock.time.plusSeconds(1200);
        sessions.transition(owner, cancel.id(), cancel.version(), HabitSessions.Action.CANCEL);
        var expire = sessions.start(owner, false, new TimerInput(UUID.randomUUID(), null, null));
        clock.time = clock.time.plusSeconds(12 * 3600);
        assertNull(sessions.active(owner));
        assertEquals(StudyState.EXPIRED,
            sessions.transition(owner, expire.id(), expire.version(), HabitSessions.Action.FINISH).state());
        assertEquals(1440, statistics.summary(owner, null, null).totalSeconds());
    }

    @Test void concurrentStartsOnlyCreateOneActiveTimer() throws Exception {
        Long owner = alice.getId();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> request = () -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                try {
                    sessions.start(owner, false, new TimerInput(UUID.randomUUID(), null, null));
                    return 201;
                } catch (ResponseStatusException conflict) {
                    return conflict.getStatusCode().value();
                }
            };
            var first = executor.submit(request);
            var second = executor.submit(request);
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(Set.of(201, 409), Set.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)));
            assertNotNull(sessions.active(owner));
        }
    }

    @Test void validatesManualLogsAndFiltersCompletesReopensAndDeletesObjectives() {
        Long owner = alice.getId();
        var input = new StudyInput(UUID.randomUUID(), null, "Practice", "Private", date("2026-11-27"), 30, null);
        Session saved = sessions.manual(owner, false, input);
        assertTrue(saved.selfReported());
        assertEquals(saved.id(), sessions.manual(owner, false, input).id());
        assertEquals(CONFLICT, assertThrows(ResponseStatusException.class, () ->
            log(owner, "2026-11-27", 30, "Practice")).getStatusCode());
        assertEquals(BAD_REQUEST, assertThrows(ResponseStatusException.class, () ->
            log(owner, "2026-11-28", 15, "Future")).getStatusCode());
        assertEquals(BAD_REQUEST, assertThrows(ResponseStatusException.class, () ->
            log(owner, "2026-11-27", 721, "Too long")).getStatusCode());
        assertEquals(FORBIDDEN, assertThrows(ResponseStatusException.class, () ->
            sessions.manual(owner, false, new StudyInput(UUID.randomUUID(), 999L, "Course", null,
                date("2026-11-27"), 15, null))).getStatusCode());
        assertEquals(BAD_REQUEST, assertThrows(ResponseStatusException.class, () ->
            sessions.manual(owner, true, new StudyInput(UUID.randomUUID(), 999L, "Course", null,
                date("2026-11-27"), 15, null))).getStatusCode());
        assertEquals(NOT_FOUND, assertThrows(ResponseStatusException.class, () ->
            sessions.delete(bob.getId(), saved.id(), saved.version())).getStatusCode());
        assertEquals(0, statistics.summary(bob.getId(), null, null).totalSeconds());

        var objective = objectives.save(owner, null, false,
            new ObjectiveInput("Write tests", null, null, date("2026-11-23"), date("2026-11-27"), 2, null));
        assertEquals(NOT_FOUND, assertThrows(ResponseStatusException.class, () ->
            objectives.status(bob.getId(), objective.id(), new ObjectiveStatus(true, objective.version()))).getStatusCode());
        var done = objectives.status(owner, objective.id(), new ObjectiveStatus(true, objective.version()));
        assertNotNull(done.completedAt());
        assertEquals(1, objectives.list(owner, date("2026-11-23"), true).size());
        assertTrue(objectives.list(owner, date("2026-11-30"), true).isEmpty());
        assertEquals(1, statistics.summary(owner, null, null).weeklyCompletedObjectives());
        var reopened = objectives.status(owner, done.id(), new ObjectiveStatus(false, done.version()));
        assertNull(reopened.completedAt());
        var renamed = objectives.save(owner, reopened.id(), false, new ObjectiveInput(
            "Review tests", "Check boundaries", null, date("2026-11-23"), null, 1, reopened.version()));
        assertEquals("Review tests", renamed.title());
        objectives.delete(owner, renamed.id(), renamed.version());
        assertTrue(objectives.list(owner, null, null).isEmpty());
    }

    @Test void permissionChecksApplyToStudentsAndAdminsAndKeepGoalOwnership() {
        var adminOnly = authenticate(bob, "ADMIN_ACCESS", "USER_LEARNING_READ");
        assertThrows(AccessDeniedException.class, () -> controller.goals(adminOnly));
        var student = authenticate(alice, "LEARNER_ACCESS", "LEARNING_SELF_READ");
        Goal goal = controller.createGoal(student, goal(GoalPeriod.WEEKLY, 180, "2026-11-23", null));
        var admin = authenticate(bob, "ADMIN_ACCESS", "LEARNER_ACCESS", "LEARNING_SELF_READ");
        assertTrue(controller.goals(admin).isEmpty());
        UserPrincipal eligibleAdmin = admin;
        assertEquals(NOT_FOUND, assertThrows(ResponseStatusException.class, () ->
            controller.archive(eligibleAdmin, goal.id(), goal.version())).getStatusCode());
        assertEquals(0, controller.statistics(admin, null, null).totalSeconds());
    }

    @Test void daySplitsRespectDaylightSavingAndYearBoundaries() {
        var interval = new StudyInterval(Instant.parse("2026-03-08T04:55:00Z"));
        interval.stoppedAt = Instant.parse("2026-03-08T07:05:00Z");
        assertEquals(Map.of(date("2026-03-07"), 300L, date("2026-03-08"), 7500L),
            HabitStatistics.split(interval, ZoneId.of("America/New_York")));
        interval = new StudyInterval(Instant.parse("2026-12-31T16:55:00Z"));
        interval.stoppedAt = Instant.parse("2026-12-31T17:15:00Z");
        assertEquals(Map.of(date("2026-12-31"), 300L, date("2027-01-01"), 900L),
            HabitStatistics.split(interval, ZoneId.of("Asia/Ho_Chi_Minh")));
    }

    @Test void malformedFiltersAndNonPositiveDurationsReturnBadRequest() throws Exception {
        authenticate(alice, "LEARNER_ACCESS", "LEARNING_SELF_READ");
        var mvc = MockMvcBuilders.standaloneSetup(controller)
            .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
            .setControllerAdvice(new com.example.starter_project_2025.exception.GlobalExceptionHandler())
            .build();
        mvc.perform(get("/api/learning/me/statistics").param("from", "not-a-date"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/learning/me/study-sessions/manual")
            .contentType("application/json")
            .content("""
                {"title":"Practice","studyDate":"2026-11-27","durationMinutes":0}
                """))
            .andExpect(status().isBadRequest());
    }

    private User user() {
        return users.saveAndFlush(User.builder().email(UUID.randomUUID() + "@example.test")
            .passwordHash("test-only").firstName("Fixture").build());
    }

    private Session log(Long owner, String day, int minutes, String title) {
        return sessions.manual(owner, false, new StudyInput(UUID.randomUUID(), null, title, null, date(day), minutes, null));
    }

    private GoalInput goal(GoalPeriod period, int minutes, String start, Long version) {
        return new GoalInput("Java study", null, period, minutes, date(start), null, version);
    }

    private UserPrincipal authenticate(User user, String... grants) {
        var authorities = Arrays.stream(grants).map(SimpleGrantedAuthority::new).toList();
        var principal = new UserPrincipal(user, List.of());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, authorities));
        return principal;
    }

    private static LocalDate date(String value) { return LocalDate.parse(value); }
}
