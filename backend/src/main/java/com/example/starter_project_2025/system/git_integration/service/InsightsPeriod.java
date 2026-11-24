package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * WS-GH-02: the resolved days of an insights request ({@code from}..{@code to}, both included) and how the
 * activity chart groups them: per day up to {@value #MAX_DAILY_DAYS} days, per week (Monday first) up to
 * {@value #MAX_WEEKLY_DAYS} days, per calendar month beyond. The first and last buckets are clipped to the period.
 */
public record InsightsPeriod(InsightsRange range, LocalDate from, LocalDate to, Granularity granularity) {

    public enum Granularity { DAY, WEEK, MONTH }

    static final int MAX_DAILY_DAYS = 31;
    static final int MAX_WEEKLY_DAYS = 200;
    /** Periods up to this length still list every day ({@code daily}, kept for existing clients). */
    static final int MAX_LISTED_DAYS = 92;

    /** Rejects a malformed request before anything is read: only {@code custom} takes since/until, and needs both. */
    public static InsightsRange requireValid(String rawRange, LocalDate since, LocalDate until, LocalDate today) {
        InsightsRange range = InsightsRange.parse(rawRange);
        if (range != InsightsRange.CUSTOM) {
            if (since != null || until != null) throw GitIntegrationException.insightsRangeInvalid();
            return range;
        }
        if (since == null || until == null || since.isAfter(until) || until.isAfter(today))
            throw GitIntegrationException.insightsRangeInvalid();
        return range;
    }

    /** {@code earliest} (first synchronized activity, may be null) is only read for {@link InsightsRange#ALL}. */
    public static InsightsPeriod resolve(InsightsRange range, LocalDate since, LocalDate until, LocalDate today,
                                         Supplier<LocalDate> earliest) {
        LocalDate from;
        LocalDate to = today;
        switch (range) {
            case CUSTOM -> {
                from = since;
                to = until;
            }
            case ALL -> {
                LocalDate first = earliest.get();
                from = first == null || first.isAfter(today) ? today : first;
            }
            default -> from = range.startFor(today);
        }
        return new InsightsPeriod(range, from, to, granularityOf(from, to));
    }

    static Granularity granularityOf(LocalDate from, LocalDate to) {
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days <= MAX_DAILY_DAYS) return Granularity.DAY;
        return days <= MAX_WEEKLY_DAYS ? Granularity.WEEK : Granularity.MONTH;
    }

    public long days() {
        return ChronoUnit.DAYS.between(from, to) + 1;
    }

    public boolean listsDays() {
        return days() <= MAX_LISTED_DAYS;
    }

    /** Consecutive {start, end} pairs (both included) covering the period. */
    public List<LocalDate[]> buckets() {
        List<LocalDate[]> buckets = new ArrayList<>();
        for (LocalDate start = from; !start.isAfter(to); ) {
            LocalDate end = switch (granularity) {
                case DAY -> start;
                case WEEK -> start.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
                case MONTH -> start.with(TemporalAdjusters.lastDayOfMonth());
            };
            if (end.isAfter(to)) end = to;
            buckets.add(new LocalDate[]{start, end});
            start = end.plusDays(1);
        }
        return buckets;
    }
}
