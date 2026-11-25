package com.example.starter_project_2025.system.learning.habits;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static com.example.starter_project_2025.system.learning.habits.HabitDtos.*;
import static com.example.starter_project_2025.system.learning.habits.HabitPolicy.*;
import static com.example.starter_project_2025.system.learning.habits.HabitGoals.*;

@Service
@RequiredArgsConstructor
public class HabitStatistics {
    private final HabitSessionRepository sessions;
    private final HabitObjectiveRepository objectives;
    private final HabitGoals goals;
    private final HabitPolicy policy;

    record Range(LocalDate from, LocalDate to) {}
    record GoalKey(GoalPeriod period, LocalDate start) {}
    record CourseKey(Long id, String name) {}
    record Totals(TreeMap<LocalDate, Long> days, Map<LocalDate, Long> selfReported,
                  Map<CourseKey, Long> courses) {}
    record Streak(int current, int longest) {}

    public record ReportStudy(long actualSeconds, long timerSeconds, long selfReportedSeconds,
        Long plannedSeconds, Long remainingSeconds, Long coveredActualSeconds, Double achievement,
        int coveredDays, int activeDays, long averageActiveDaySeconds, int currentStreak, int longestStreak,
        List<Daily> days, List<Weekly> weeks, List<ByCourse> byCourse,
        @com.fasterxml.jackson.annotation.JsonIgnore Objectives objectives) {
        public record Daily(LocalDate date, long seconds, long selfReportedSeconds, boolean active) {}
        public record Weekly(LocalDate start, Long plannedSeconds, long actualSeconds) {}
        public record ByCourse(Long courseId, String name, long seconds) {}
        public record Objectives(int total, int completed, int overdue, int completedDuringPeriod) {}
    }

    public ZoneId reportingZone() {
        return policy.zone();
    }

    @Transactional(readOnly = true)
    public ReportStudy report(Long owner, LocalDate from, LocalDate to, boolean preferMonthly) {
        Range range = range(from, to, policy.today());
        Totals totals = totals(owner, range);
        var available = targets(owner, from, to);
        GoalPeriod preferred = preferMonthly ? GoalPeriod.MONTHLY : GoalPeriod.WEEKLY;
        GoalPeriod alternate = preferMonthly ? GoalPeriod.WEEKLY : GoalPeriod.MONTHLY;
        long planned = 0, covered = 0, manual = 0, activeSeconds = 0;
        int coveredDays = 0, activeDays = 0;
        Map<LocalDate, long[]> weeks = new LinkedHashMap<>();
        List<ReportStudy.Daily> daily = new ArrayList<>();
        for (Day day : days(totals, range)) {
            LocalDate date = day.date();
            manual += day.selfReportedSeconds();
            if (day.active()) {
                activeDays++;
                activeSeconds += day.seconds();
            }
            daily.add(new ReportStudy.Daily(date, day.seconds(), day.selfReportedSeconds(), day.active()));
            var week = weeks.computeIfAbsent(periodStart(date, GoalPeriod.WEEKLY), key -> new long[3]);
            week[1] += day.seconds();
            HabitGoalTarget target = applicableTarget(available, date, preferred);
            if (target == null) target = applicableTarget(available, date, alternate);
            if (target == null) continue;
            long length = ChronoUnit.DAYS.between(target.fromDate, target.toDate) + 1;
            long offset = ChronoUnit.DAYS.between(target.fromDate, date);
            long seconds = target.targetMinutes * 60L;
            long allocated = seconds * (offset + 1) / length - seconds * offset / length;
            planned += allocated;
            covered += day.seconds();
            coveredDays++;
            week[0] += allocated;
            week[2]++;
        }
        var selectedObjectives = objectives.findByOwnerIdAndWeekStartBetween(owner,
            periodStart(from, GoalPeriod.WEEKLY), periodStart(to, GoalPeriod.WEEKLY)).stream()
            .filter(item -> item.targetDate != null
                ? !item.targetDate.isBefore(from) && !item.targetDate.isAfter(to)
                : !item.weekStart.plusDays(6).isBefore(from) && !item.weekStart.isAfter(to))
            .toList();
        LocalDate today = policy.today();
        int overdue = (int) selectedObjectives.stream()
            .filter(item -> item.completedAt == null && item.targetDate != null && item.targetDate.isBefore(today)).count();
        int completedDuring = (int) selectedObjectives.stream().filter(item -> item.completedAt != null)
            .map(item -> LocalDate.ofInstant(item.completedAt, policy.zone()))
            .filter(date -> !date.isBefore(from) && !date.isAfter(to)).count();
        var objectiveStats = new ReportStudy.Objectives(selectedObjectives.size(), completed(selectedObjectives),
            overdue, completedDuring);
        long actual = sum(totals, from, to);
        long threshold = policy.activeDayMinutes() * 60L;
        return new ReportStudy(actual, actual - manual, manual, coveredDays == 0 ? null : planned,
            coveredDays == 0 ? null : Math.max(0, planned - covered), coveredDays == 0 ? null : covered,
            planned == 0 ? null : 100.0 * covered / planned, coveredDays, activeDays,
            activeDays == 0 ? 0 : activeSeconds / activeDays, streak(totals.days, to, threshold).current,
            streak(totals.days.subMap(from, true, to, true), to, threshold).longest, daily,
            weeks.entrySet().stream().map(entry -> new ReportStudy.Weekly(entry.getKey(),
                entry.getValue()[2] == 0 ? null : entry.getValue()[0], entry.getValue()[1])).toList(),
            totals.courses.entrySet().stream().map(entry -> new ReportStudy.ByCourse(entry.getKey().id,
                entry.getKey().name, entry.getValue())).sorted(Comparator.comparingLong(ReportStudy.ByCourse::seconds)
                .reversed().thenComparing(ReportStudy.ByCourse::name)).toList(), objectiveStats);
    }

    private HabitGoalTarget applicableTarget(Map<GoalKey, HabitGoalTarget> targets, LocalDate date, GoalPeriod type) {
        HabitGoalTarget target = targets.get(new GoalKey(type, periodStart(date, type)));
        return target != null && !date.isBefore(target.fromDate) && !date.isAfter(target.toDate) ? target : null;
    }

    @Transactional(readOnly = true)
    public Statistics summary(Long owner, LocalDate from, LocalDate to) {
        LocalDate today = policy.today();
        LocalDate week = periodStart(today, GoalPeriod.WEEKLY);
        LocalDate month = today.withDayOfMonth(1);
        Range range = range(from, to, today);
        Totals totals = totals(owner, range);
        Map<GoalKey, HabitGoalTarget> targets = targets(owner, range.from, range.to);
        Map<GoalKey, HabitGoalTarget> currentTargets = targets(owner, earlier(week, month), today);
        Streak streak = streak(totals.days, today, policy.activeDayMinutes() * 60L);
        List<Day> days = days(totals, range);
        List<Day> active = days.stream().filter(Day::active).toList();
        List<Day> currentWeek = days(totals, new Range(week, week.plusDays(6)));
        LocalDate firstWeek = periodStart(range.from, GoalPeriod.WEEKLY);
        LocalDate lastWeek = periodStart(range.to, GoalPeriod.WEEKLY);
        var weekly = firstWeek.datesUntil(lastWeek.plusDays(1), Period.ofWeeks(1)).map(start -> {
            HabitGoalTarget target = targets.get(new GoalKey(GoalPeriod.WEEKLY, start));
            long actual = sum(totals, start, start.plusDays(6));
            return new Week(start, actual, target == null ? null : target.targetMinutes);
        }).toList();
        var tracked = weekly.stream().filter(row -> row.targetMinutes() != null).toList();
        long achieved = tracked.stream().filter(row -> {
            var target = targets.get(new GoalKey(GoalPeriod.WEEKLY, row.start()));
            return sum(totals, target.fromDate, target.toDate) >= target.targetMinutes * 60L;
        }).count();
        var courseTimes = totals.courses.entrySet().stream()
            .map(entry -> new CourseTime(entry.getKey().id, entry.getKey().name, entry.getValue()))
            .sorted(Comparator.comparingLong(CourseTime::seconds).reversed().thenComparing(CourseTime::name)).toList();
        var rangedObjectives = objectives.findByOwnerIdAndWeekStartBetween(owner, firstWeek, lastWeek);
        var weekObjectives = objectives.findByOwnerIdAndWeekStartOrderByDisplayOrderAscIdAsc(owner, week);
        return new Statistics(today, week, range.from, range.to, policy.zone().getId(), policy.activeDayMinutes(),
            policy.maxManualMinutes(), totals.days.values().stream().mapToLong(Long::longValue).sum(),
            sum(totals, range.from, range.to), sum(totals, today, today), sum(totals, week, today),
            sum(totals, month, today), active.isEmpty() ? 0 : active.stream().mapToLong(Day::seconds).sum() / active.size(),
            active.size(), streak.current, streak.longest, completed(rangedObjectives), rangedObjectives.size(),
            completed(weekObjectives), weekObjectives.size(), (int) achieved, tracked.size(),
            progress(currentTargets.get(new GoalKey(GoalPeriod.WEEKLY, week)), totals),
            progress(currentTargets.get(new GoalKey(GoalPeriod.MONTHLY, month)), totals), days, currentWeek, weekly, courseTimes);
    }

    @Transactional(readOnly = true)
    public List<Day> activity(Long owner, LocalDate from, LocalDate to) {
        Range range = range(from, to, policy.today());
        return days(totals(owner, range), range);
    }

    @Transactional(readOnly = true)
    public List<GoalProgress> history(Long owner, LocalDate from, LocalDate to, GoalPeriod period) {
        Range range = range(from, to, policy.today());
        Totals totals = totals(owner, range);
        return targets(owner, range.from, range.to).values().stream()
            .filter(target -> period == null || target.period == period)
            .map(target -> progress(target, totals))
            .sorted(Comparator.comparing(GoalProgress::periodStart).reversed().thenComparing(GoalProgress::period))
            .toList();
    }

    private Range range(LocalDate from, LocalDate to, LocalDate today) {
        LocalDate end = to == null ? today : to;
        LocalDate start = from == null ? periodStart(end, GoalPeriod.WEEKLY).minusWeeks(3) : from;
        validDate(start);
        validDate(end);
        if (start.isAfter(end) || ChronoUnit.DAYS.between(start, end) >= 366) {
            throw bad("Select a date range of up to 366 days");
        }
        if (end.isAfter(today)) throw bad("End date cannot be in the future");
        return new Range(start, end);
    }

    private Totals totals(Long owner, Range range) {
        Totals totals = new Totals(new TreeMap<>(), new HashMap<>(), new LinkedHashMap<>());
        for (HabitSession row : sessions.findByOwnerIdAndStateAndDeletedFalse(owner, StudyState.COMPLETED)) {
            if (row.source == StudySource.MANUAL || row.corrected) {
                add(totals, range, row, row.studyDate, row.elapsedSeconds, true);
                continue;
            }
            ZoneId zone = ZoneId.of(row.zone);
            for (StudyInterval interval : row.intervals) {
                split(interval, zone).forEach((date, seconds) -> add(totals, range, row, date, seconds, false));
            }
        }
        return totals;
    }

    static Map<LocalDate, Long> split(StudyInterval interval, ZoneId zone) {
        Map<LocalDate, Long> result = new LinkedHashMap<>();
        if (interval.stoppedAt == null) return result;
        Instant cursor = interval.startedAt;
        while (cursor.isBefore(interval.stoppedAt)) {
            LocalDate date = LocalDate.ofInstant(cursor, zone);
            Instant midnight = date.plusDays(1).atStartOfDay(zone).toInstant();
            Instant stop = midnight.isBefore(interval.stoppedAt) ? midnight : interval.stoppedAt;
            result.put(date, Duration.between(cursor, stop).toSeconds());
            cursor = stop;
        }
        return result;
    }

    private void add(Totals totals, Range range, HabitSession row, LocalDate date, long seconds, boolean selfReported) {
        if (seconds <= 0) return;
        totals.days.merge(date, seconds, Long::sum);
        if (selfReported) totals.selfReported.merge(date, seconds, Long::sum);
        if (!date.isBefore(range.from) && !date.isAfter(range.to)) {
            String name = row.courseId == null ? "General Study" : Objects.requireNonNullElse(row.courseName, "Unavailable course");
            CourseKey key = totals.courses.keySet().stream().filter(course -> Objects.equals(course.id, row.courseId))
                .findFirst().orElse(new CourseKey(row.courseId, name));
            totals.courses.merge(key, seconds, Long::sum);
        }
    }

    private Map<GoalKey, HabitGoalTarget> targets(Long owner, LocalDate from, LocalDate to) {
        Map<GoalKey, HabitGoalTarget> result = new HashMap<>();
        for (HabitGoalTarget target : goals.history(owner)) {
            if (!target.toDate.isBefore(from) && !target.fromDate.isAfter(to)) {
                result.put(new GoalKey(target.period, target.periodStart), target);
            }
        }
        for (HabitGoal goal : goals.entities(owner)) {
            for (LocalDate start = periodStart(from, goal.period); !start.isAfter(to); start = nextPeriod(start, goal.period)) {
                HabitGoalTarget target = targetFor(goal, start);
                GoalKey key = new GoalKey(goal.period, start);
                if (target != null && !target.toDate.isBefore(from) && !target.fromDate.isAfter(to)) {
                    result.merge(key, target, (previous, candidate) ->
                        candidate.goalId > previous.goalId ? candidate : previous);
                }
            }
        }
        return result;
    }

    private GoalProgress progress(HabitGoalTarget target, Totals totals) {
        if (target == null) return null;
        long actual = sum(totals, target.fromDate, target.toDate);
        long planned = target.targetMinutes * 60L;
        return new GoalProgress(target.goalId, target.title, target.period, target.periodStart,
            target.fromDate, target.toDate, target.targetMinutes, actual, Math.max(0, planned - actual),
            100.0 * actual / planned);
    }

    private List<Day> days(Totals totals, Range range) {
        return range.from.datesUntil(range.to.plusDays(1)).map(date -> {
            long seconds = totals.days.getOrDefault(date, 0L);
            return new Day(date, seconds, totals.selfReported.getOrDefault(date, 0L),
                seconds >= policy.activeDayMinutes() * 60L);
        }).toList();
    }

    private static long sum(Totals totals, LocalDate from, LocalDate to) {
        return totals.days.subMap(from, true, to, true).values().stream().mapToLong(Long::longValue).sum();
    }

    static Streak streak(SortedMap<LocalDate, Long> days, LocalDate today, long threshold) {
        LocalDate last = null;
        int run = 0;
        int longest = 0;
        for (var entry : days.entrySet()) {
            LocalDate day = entry.getKey();
            if (day.isAfter(today) || entry.getValue() < threshold) continue;
            run = last != null && last.plusDays(1).equals(day) ? run + 1 : 1;
            longest = Math.max(longest, run);
            last = day;
        }
        int current = last != null && !last.isBefore(today.minusDays(1)) ? run : 0;
        return new Streak(current, longest);
    }

    private int completed(List<HabitObjective> rows) {
        return (int) rows.stream().filter(row -> row.completedAt != null).count();
    }
}
