package com.example.starter_project_2025.system.learning.habits;

import jakarta.validation.constraints.*;
import java.time.*;
import java.util.List;
import java.util.UUID;

final class HabitDtos {
    private HabitDtos() {}

    record CourseOption(Long id, String name) {}
    record GoalInput(@NotBlank @Size(max = 150) String title, @Size(max = 2000) String description,
        @NotNull GoalPeriod period, @NotNull @Min(1) @Max(44640) Integer targetMinutes,
        @NotNull LocalDate startDate, LocalDate endDate, @PositiveOrZero Long version) {}
    record Goal(Long id, long version, String title, String description, GoalPeriod period,
        int targetMinutes, LocalDate startDate, LocalDate endDate, LocalDate archivedOn, String status) {}
    record GoalProgress(Long goalId, String title, GoalPeriod period, LocalDate periodStart,
        LocalDate fromDate, LocalDate toDate, int targetMinutes, long actualSeconds,
        long remainingSeconds, double percentage) {}

    record TimerInput(@NotNull UUID requestKey, @Positive Long courseId, @Size(max = 150) String title) {}
    record StudyInput(UUID requestKey, @Positive Long courseId, @NotBlank @Size(max = 150) String title,
        @Size(max = 2000) String notes, @NotNull LocalDate studyDate, @NotNull @Positive Integer durationMinutes,
        @PositiveOrZero Long version) {}
    record Session(Long id, long version, Long courseId, String courseName, String title, String notes,
        StudySource source, StudyState state, boolean selfReported, LocalDate studyDate,
        long elapsedSeconds, Instant createdAt, Instant finishedAt, Instant serverNow, Instant expiresAt) {}
    record History(List<Session> items, boolean hasMore) {}

    record ObjectiveInput(@NotBlank @Size(max = 150) String title, @Size(max = 2000) String description,
        @Positive Long courseId, @NotNull LocalDate weekStart, LocalDate targetDate,
        @NotNull @Min(0) @Max(9999) Integer displayOrder, @PositiveOrZero Long version) {}
    record Objective(Long id, long version, Long courseId, String courseName, String title, String description,
        LocalDate weekStart, LocalDate targetDate, Instant completedAt, int displayOrder) {}
    record ObjectiveStatus(@NotNull Boolean completed, @NotNull @PositiveOrZero Long version) {}

    record Day(LocalDate date, long seconds, long selfReportedSeconds, boolean active) {}
    record Week(LocalDate start, long actualSeconds, Integer targetMinutes) {}
    record CourseTime(Long courseId, String name, long seconds) {}
    record Statistics(LocalDate today, LocalDate weekStart, LocalDate from, LocalDate to, String zone,
        int activeDayMinutes, int maxManualMinutes, long totalSeconds, long rangeSeconds,
        long todaySeconds, long weekSeconds, long monthSeconds, long averageActiveDaySeconds, int activeDays,
        int currentStreak, int longestStreak, int completedObjectives, int totalObjectives,
        int weeklyCompletedObjectives, int weeklyTotalObjectives, int weeklyGoalsAchieved, int weeklyGoalsTracked,
        GoalProgress weeklyGoal, GoalProgress monthlyGoal, List<Day> days, List<Day> currentWeek,
        List<Week> weeks, List<CourseTime> byCourse) {}
}
