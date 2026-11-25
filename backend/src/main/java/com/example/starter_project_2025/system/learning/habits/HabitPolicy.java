package com.example.starter_project_2025.system.learning.habits;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import static org.springframework.http.HttpStatus.*;

@Component
class HabitPolicy {
    static final LocalDate EARLIEST = LocalDate.of(1900, 1, 1);
    static final LocalDate LATEST = LocalDate.of(9999, 12, 31);

    private final EntityManager entityManager;
    private final CourseEnrollmentRepository enrollments;
    private final ZoneId zone;
    private final Duration timerLimit;
    private final int maxManualMinutes;
    private final int activeDayMinutes;
    private final Clock clock;

    HabitPolicy(EntityManager entityManager, CourseEnrollmentRepository enrollments,
                @Value("${app.learning.habits.zone:Asia/Ho_Chi_Minh}") String zone,
                @Value("${app.learning.habits.timer-limit-hours:12}") int limitHours,
                @Value("${app.learning.habits.max-manual-minutes:720}") int maxManualMinutes,
                @Value("${app.learning.habits.active-day-minutes:15}") int activeDayMinutes,
                org.springframework.beans.factory.ObjectProvider<Clock> clocks) {
        this.entityManager = entityManager;
        this.enrollments = enrollments;
        this.zone = ZoneId.of(zone);
        this.timerLimit = Duration.ofHours(limitHours);
        this.maxManualMinutes = maxManualMinutes;
        this.activeDayMinutes = activeDayMinutes;
        this.clock = clocks.getIfUnique(Clock::systemUTC);
        if (limitHours < 1 || limitHours > 24 || maxManualMinutes < 1 || maxManualMinutes > 1440
            || activeDayMinutes < 1 || activeDayMinutes > 1440) {
            throw new IllegalArgumentException("Invalid Goals & Habits configuration");
        }
    }

    Instant now() { return clock.instant(); }
    LocalDate today() { return LocalDate.ofInstant(now(), zone); }
    ZoneId zone() { return zone; }
    Duration timerLimit() { return timerLimit; }
    int maxManualMinutes() { return maxManualMinutes; }
    int activeDayMinutes() { return activeDayMinutes; }

    void lockOwner(Long owner) {
        if (entityManager.find(User.class, owner, LockModeType.PESSIMISTIC_WRITE) == null) {
            throw missing();
        }
    }

    HabitDtos.CourseOption course(Long owner, Long id, boolean canRead) {
        if (id == null) return new HabitDtos.CourseOption(null, null);
        if (!canRead) throw new ResponseStatusException(FORBIDDEN, "Course access is required");
        return enrollments.findByUser_IdAndCourse_Id(owner, id)
            .map(row -> new HabitDtos.CourseOption(id, row.getCourse().getName()))
            .orElseThrow(() -> bad("Select a course from your enrollments"));
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<HabitDtos.CourseOption> courses(Long owner, boolean canRead) {
        if (!canRead) return List.of();
        return enrollments.findAllByUser_IdOrderByCreatedAtDesc(owner).stream()
            .map(row -> new HabitDtos.CourseOption(row.getCourse().getId(), row.getCourse().getName()))
            .distinct().toList();
    }

    static LocalDate periodStart(LocalDate day, GoalPeriod period) {
        return period == GoalPeriod.MONTHLY ? day.withDayOfMonth(1)
            : day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    static LocalDate nextPeriod(LocalDate start, GoalPeriod period) {
        return period == GoalPeriod.MONTHLY ? start.plusMonths(1) : start.plusWeeks(1);
    }

    static void validDate(LocalDate date) {
        if (date != null && (date.isBefore(EARLIEST) || date.isAfter(LATEST))) {
            throw bad("Date is outside the supported range");
        }
    }

    static void checkVersion(Long supplied, long current) {
        if (supplied == null || supplied != current) throw conflict("This record changed. Refresh and try again.");
    }

    static String optional(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    static ResponseStatusException bad(String message) { return new ResponseStatusException(BAD_REQUEST, message); }
    static ResponseStatusException conflict(String message) { return new ResponseStatusException(CONFLICT, message); }
    static ResponseStatusException missing() { return new ResponseStatusException(NOT_FOUND, "Record not found"); }
}
