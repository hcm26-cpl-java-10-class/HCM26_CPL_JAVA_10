package com.example.starter_project_2025.system.project.analytics;

import java.time.LocalDate;
import java.util.List;

/**
 * US-ANL-002: payload of the project Analytics view.
 *
 * <p>The payload answers three questions in one read-only request:</p>
 * <ol>
 *     <li>{@link #filters()} — which scope / sprint / work item type / date
 *     range the backend actually applied, plus the Sprint dropdown population
 *     and the option lists the filter bar needs.</li>
 *     <li>{@link #kpis()} — the KPI cards, recalculated for the applied
 *     filter.</li>
 *     <li>{@link #creationTrend()} — the US-ANL-004 stacked bar chart of the
 *     work items created per creation date, split into Done and To do.</li>
 *     <li>{@link #widgets()} — the four trend charts, bucketed inside
 *     {@link #window()}.</li>
 * </ol>
 */
public record ProjectAnalyticsResponse(
        Long projectId,
        String projectCode,
        String projectName,
        String projectStatus,
        boolean readOnly,
        Filters filters,
        Window window,
        List<Kpi> kpis,
        CreationTrend creationTrend,
        CycleTimeTrend cycleTimeTrend,
        List<Widget> widgets
) {

    /**
     * The applied filter echo.
     *
     * <p>{@code scope} and {@code sprintId} are already resolved (an empty
     * request resolves to the active sprint, otherwise to {@code ALL}), while
     * {@code startDate} / {@code endDate} are the requested values: the
     * effective window lives in {@link Window}, so the filter bar never shows a
     * date the user did not pick.</p>
     */
    public record Filters(
            String scope,
            Long sprintId,
            String itemType,
            LocalDate startDate,
            LocalDate endDate,
            List<SprintOption> sprints,
            Long defaultSprintId,
            long backlogItemCount,
            List<String> itemTypes
    ) { }

    /** One entry of the Scope/Sprint dropdown, ordered chronologically. */
    public record SprintOption(
            Long sprintId,
            String name,
            String status,
            LocalDate startDate,
            LocalDate endDate,
            long workItemCount
    ) { }

    /** Effective chart window and bucket size. */
    public record Window(LocalDate startDate, LocalDate endDate, String granularity) { }

    /**
     * One KPI card of the US-ANL-003 summary strip.
     *
     * <p>The value is preformatted by the backend so the card, the API and the
     * acceptance criteria can never disagree about the number of decimals:</p>
     * <ul>
     *     <li>{@code total-work-items} — {@code "20"}</li>
     *     <li>{@code completion-rate} — {@code "75.0%"}, or {@code "0.0%"} when
     *     the scope is empty (AC02)</li>
     *     <li>{@code avg-cycle-time} / {@code avg-lead-time} — {@code "2.4 days"},
     *     or {@code "N/A"} when no item is Done (AC02)</li>
     * </ul>
     *
     * @param unit     {@code items}, {@code percent} or {@code days}
     * @param caption  sub-label of the card (Done vs. To do split for KPI 1)
     * @param subCaption second sub-label, currently the estimated hours split
     *                 (AC03); {@code null} when the card has only one caption
     */
    public record Kpi(
            String key,
            String label,
            String value,
            String unit,
            String hint,
            String caption,
            String subCaption
    ) { }

    /**
     * US-ANL-004: work item creation trend, one stacked bar per creation date.
     *
     * <p>The chart only reports the dates that actually received a work item
     * (it is a trend, not a calendar), ordered oldest first. Every bar is a
     * full stack: {@code done} forms the bottom segment and {@code todo} the
     * cap, so the bar total is the number of work items created that day.</p>
     *
     * @param series {@code done} first (bottom segment), then {@code todo}
     */
    public record CreationTrend(String state, List<Series> series, List<CreationBucket> buckets) { }

    /**
     * One creation-date bucket of the US-ANL-004 chart.
     *
     * <p>{@link #done} counts the work items created on {@link #date} that are
     * Done as of the end of the chart window; {@link #todo} counts the ones
     * still open (To do, In progress, Review or Blocked). An item is never in
     * both segments, so {@code done + todo} is the daily creation count.</p>
     */
    public record CreationBucket(LocalDate date, long done, long todo) { }

    /**
     * US-ANL-005: "Work item cycle time" line chart.
     *
     * <p>One point per completion date (tenant time zone, oldest first) that
     * has at least one completed work item inside the chart window. Items that
     * are not Done as of the end of the window are excluded (AC03).</p>
     *
     * @param timeZone tenant time zone used to derive the completion dates
     */
    public record CycleTimeTrend(String state, String timeZone, List<CycleTimePoint> points) { }

    /**
     * One point of the US-ANL-005 chart.
     *
     * @param date        completion date ({@code YYYY-MM-DD})
     * @param averageDays mean cycle time of the items completed that day,
     *                    rounded to one decimal (AC01)
     * @param itemCount   number of completed items averaged into the point
     */
    public record CycleTimePoint(LocalDate date, double averageDays, int itemCount) { }

    /**
     * One trend chart.
     *
     * @param kind one of {@code BAR}, {@code AREA}, {@code LINE}
     */
    public record Widget(String key, String title, String description, String state,
                         String kind, List<Series> series, List<Bucket> buckets) { }

    /** A chart series: {@code key} selects the {@link Bucket} value field. */
    public record Series(String key, String label) { }

    /**
     * One X-axis bucket.
     *
     * <p>{@link #created} and {@link #completed} are activity counts inside the
     * bucket, while {@link #todo} / {@link #inProgress} / {@link #review} /
     * {@link #done} are the status snapshot at the end of the bucket (used by
     * the cumulative flow chart). {@link #ideal} is the linear burndown
     * reference line.</p>
     */
    public record Bucket(
            LocalDate date,
            long created,
            long completed,
            long todo,
            long inProgress,
            long review,
            long done,
            long remaining,
            long ideal
    ) { }
}
