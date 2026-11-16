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
     * One KPI card.
     *
     * @param unit {@code items} or {@code percent}
     */
    public record Kpi(String key, String label, long value, String unit, String hint) { }

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
