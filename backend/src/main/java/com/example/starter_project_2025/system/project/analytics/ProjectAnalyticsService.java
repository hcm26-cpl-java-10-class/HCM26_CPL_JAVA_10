package com.example.starter_project_2025.system.project.analytics;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogWorkType;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

/**
 * US-ANL-002: Sprint &amp; Backlog data collection and scope filtering.
 *
 * <p>One read-only request collects every work item of the project that matches
 * the scope filter ({@code ALL}, {@code BACKLOG}, {@code SPRINT}), the optional
 * work item type and the optional date window, and projects it onto the KPI
 * cards and the four trend charts. Nothing is ever written: analytics must not
 * plan, move or complete a work item.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectAnalyticsService {

    /** Work item type option meaning "do not filter by type". */
    static final String ANY_ITEM_TYPE = "ALL";

    /** Work item type options offered by the filter bar. */
    static final List<String> ITEM_TYPES = List.of(ANY_ITEM_TYPE, "STORY", "BUG", "TASK");

    private static final String STATE_READY = "READY";
    private static final String STATE_EMPTY = "EMPTY";
    private static final String UNIT_ITEMS = "items";
    private static final String UNIT_PERCENT = "percent";
    private static final String UNIT_DAYS = "days";

    /** US-ANL-003 AC02: shown instead of a numeric average when nothing is Done. */
    private static final String NOT_AVAILABLE = "N/A";

    /** Window used when a project has no work item activity at all. */
    private static final int DEFAULT_WINDOW_DAYS = 30;

    /** Safety cap so one request can never explode the number of chart buckets. */
    private static final int MAX_WINDOW_DAYS = 365;

    private static final int DAY_BUCKET_LIMIT_DAYS = 31;
    private static final int WEEK_BUCKET_LIMIT_DAYS = 120;

    private final ProjectAnalyticsAccess access;
    private final ProjectRepository projects;
    private final SprintRepository sprints;
    private final ProjectAnalyticsWorkItemRepository workItems;
    private final ObjectMapper objectMapper;

    /**
     * US-ANL-005: tenant time zone used to group completions by calendar day.
     * Falls back to the backlog notification zone shared by the project module.
     */
    @Value("${app.analytics.tenant-time-zone:${app.notification.backlog-time-zone:Asia/Ho_Chi_Minh}}")
    private String tenantTimeZone;

    /** US-ANL-001 compatibility: the shell without any filter. */
    public ProjectAnalyticsResponse shell(String rawProjectId) {
        return shell(rawProjectId, ProjectAnalyticsFilter.empty());
    }

    public ProjectAnalyticsResponse shell(String rawProjectId, ProjectAnalyticsFilter requested) {
        User user = access.requireUser();
        Project project = access.requireProject(user, rawProjectId);
        ProjectAnalyticsFilter filter = requested == null ? ProjectAnalyticsFilter.empty() : requested;

        ProjectAnalyticsScope scope = ProjectAnalyticsScope.parse(filter.scope(), filter.sprintId());
        SprintBacklogWorkType workType = parseItemType(filter.itemType());
        LocalDate requestedStart = filter.startDate();
        LocalDate requestedEnd = filter.endDate();

        // AC04: the window must be ordered before anything is aggregated.
        if (requestedStart != null && requestedEnd != null && requestedStart.isAfter(requestedEnd)) {
            throw new ProjectAnalyticsValidationException("endDate",
                    "The end date must be on or after the start date");
        }

        List<Sprint> projectSprints = chronological(
                sprints.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(project.getId()));
        Sprint activeSprint = projectSprints.stream()
                .filter(sprint -> sprint.getStatus() == SprintStatus.ACTIVE)
                .findFirst()
                .orElse(null);

        // AC04: a sprint of another project is rejected before it is used.
        Sprint selected = null;
        if (filter.sprintId() != null) {
            selected = projectSprints.stream()
                    .filter(sprint -> filter.sprintId().equals(sprint.getId()))
                    .findFirst()
                    .orElseThrow(() -> new ProjectAnalyticsValidationException("sprintId",
                            "The selected sprint does not belong to this project"));
        }
        if (scope == ProjectAnalyticsScope.SPRINT) {
            if (selected == null) {
                // Sprint dropdown default: the active sprint, otherwise the latest one.
                selected = activeSprint != null
                        ? activeSprint
                        : (projectSprints.isEmpty() ? null : projectSprints.get(projectSprints.size() - 1));
            }
            if (selected == null) {
                throw new ProjectAnalyticsValidationException("sprintId",
                        "This project has no sprint to analyse yet");
            }
        } else {
            // Only the SPRINT scope narrows the query by sprint, so the echo
            // never reports a sprint the aggregation did not use.
            selected = null;
        }

        List<SprintBacklog> items = workItems.findWorkItems(
                project.getId(),
                selected == null ? null : selected.getId(),
                scope == ProjectAnalyticsScope.BACKLOG,
                workType);

        LocalDate windowStart = resolveWindowStart(requestedStart, items);
        LocalDate windowEnd = resolveWindowEnd(requestedEnd, items);
        if (windowEnd.isBefore(windowStart)) {
            windowEnd = windowStart;
        }
        if (ChronoUnit.DAYS.between(windowStart, windowEnd) >= MAX_WINDOW_DAYS) {
            windowStart = windowEnd.minusDays(MAX_WINDOW_DAYS - 1L);
        }

        LocalDate resolvedEnd = windowEnd;
        long population = items.stream()
                .map(ProjectAnalyticsService::createdOn)
                .filter(Objects::nonNull)
                .filter(date -> !date.isAfter(resolvedEnd))
                .count();
        String granularity = granularityOf(windowStart, windowEnd);
        List<ProjectAnalyticsResponse.Bucket> buckets =
                buckets(items, windowStart, windowEnd, granularity, population);

        List<ProjectAnalyticsResponse.Kpi> kpis =
                kpis(scope, selected, items, windowStart, windowEnd);
        ProjectAnalyticsResponse.CreationTrend creationTrend =
                creationTrend(items, windowStart, windowEnd);
        ProjectAnalyticsResponse.CycleTimeTrend cycleTimeTrend =
                cycleTimeTrend(items, windowStart, windowEnd);
        List<ProjectAnalyticsResponse.Widget> widgets =
                widgets(items.isEmpty() ? STATE_EMPTY : STATE_READY, granularity, buckets);

        return new ProjectAnalyticsResponse(
                project.getId(),
                project.getCode(),
                project.getName(),
                project.getStatus() == null ? null : project.getStatus().name(),
                true,
                new ProjectAnalyticsResponse.Filters(
                        scope.name(),
                        selected == null ? null : selected.getId(),
                        workType == null ? ANY_ITEM_TYPE : workType.name(),
                        requestedStart,
                        requestedEnd,
                        sprintOptions(projectSprints, workItems.countWorkItemsBySprint(project.getId())),
                        activeSprint == null ? null : activeSprint.getId(),
                        workItems.countProductBacklog(project.getId()),
                        ITEM_TYPES),
                new ProjectAnalyticsResponse.Window(windowStart, windowEnd, granularity),
                kpis,
                creationTrend,
                cycleTimeTrend,
                widgets);
    }

    /**
     * US-ANL-001: projects the caller may open Analytics for. Used by the
     * Learning Analytics project selector; every option has already passed the
     * same membership/mentor/PM scope check as the analytics endpoint.
     */
    public List<ProjectAnalyticsProjectOption> projects() {
        User user = access.requireUser();
        return projects.findByTenantIdAndIsActiveTrue(user.getTenantId()).stream()
                .filter(project -> access.canView(user, project))
                .sorted(Comparator.comparing(Project::getName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(Project::getId))
                .map(project -> new ProjectAnalyticsProjectOption(
                        project.getId(),
                        project.getCode(),
                        project.getName(),
                        project.getStatus() == null ? null : project.getStatus().name()))
                .toList();
    }

    // ---------------------------------------------------------------------
    // Filter parsing
    // ---------------------------------------------------------------------

    private SprintBacklogWorkType parseItemType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim().toUpperCase(Locale.ROOT);
        if (ANY_ITEM_TYPE.equals(value)) {
            return null;
        }
        for (SprintBacklogWorkType type : SprintBacklogWorkType.values()) {
            if (type.name().equals(value)) {
                return type;
            }
        }
        throw new ProjectAnalyticsValidationException("itemType",
                "Work item type must be one of ALL, STORY, BUG or TASK");
    }

    private static List<Sprint> chronological(List<Sprint> source) {
        return source.stream()
                .sorted(Comparator
                        .comparing(ProjectAnalyticsService::sprintStart, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Sprint::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private static LocalDateTime sprintStart(Sprint sprint) {
        return sprint.getStartDate();
    }

    private static List<ProjectAnalyticsResponse.SprintOption> sprintOptions(
            List<Sprint> source, Map<Long, Long> workItemCounts) {
        return source.stream()
                .map(sprint -> new ProjectAnalyticsResponse.SprintOption(
                        sprint.getId(),
                        sprint.getName(),
                        sprint.getStatus() == null ? null : sprint.getStatus().name(),
                        sprint.getStartDate() == null ? null : sprint.getStartDate().toLocalDate(),
                        sprint.getEndDate() == null ? null : sprint.getEndDate().toLocalDate(),
                        workItemCounts.getOrDefault(sprint.getId(), 0L)))
                .toList();
    }

    // ---------------------------------------------------------------------
    // Chart window and buckets
    // ---------------------------------------------------------------------

    private static LocalDate resolveWindowStart(LocalDate requested, List<SprintBacklog> items) {
        if (requested != null) {
            return requested;
        }
        return items.stream()
                .map(ProjectAnalyticsService::createdOn)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(LocalDate.now().minusDays(DEFAULT_WINDOW_DAYS - 1L));
    }

    private static LocalDate resolveWindowEnd(LocalDate requested, List<SprintBacklog> items) {
        if (requested != null) {
            return requested;
        }
        LocalDate today = LocalDate.now();
        LocalDate latest = items.stream()
                .map(ProjectAnalyticsService::updatedOn)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
        return latest != null && latest.isAfter(today) ? latest : today;
    }

    private static String granularityOf(LocalDate start, LocalDate end) {
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        if (days <= DAY_BUCKET_LIMIT_DAYS) {
            return "DAY";
        }
        return days <= WEEK_BUCKET_LIMIT_DAYS ? "WEEK" : "MONTH";
    }

    private List<ProjectAnalyticsResponse.Bucket> buckets(List<SprintBacklog> items, LocalDate start,
                                                          LocalDate end, String granularity, long population) {
        long totalDays = ChronoUnit.DAYS.between(start, end) + 1;
        List<ProjectAnalyticsResponse.Bucket> buckets = new ArrayList<>();
        LocalDate cursor = "MONTH".equals(granularity) ? start.withDayOfMonth(1) : start;
        while (!cursor.isAfter(end)) {
            LocalDate next = switch (granularity) {
                case "WEEK" -> cursor.plusWeeks(1);
                case "MONTH" -> cursor.plusMonths(1);
                default -> cursor.plusDays(1);
            };
            LocalDate bucketStart = cursor.isBefore(start) ? start : cursor;
            LocalDate bucketEnd = next.minusDays(1);
            if (bucketEnd.isAfter(end)) {
                bucketEnd = end;
            }
            buckets.add(bucket(items, bucketStart, bucketEnd, start, totalDays, population));
            cursor = next;
        }
        return buckets;
    }

    private static ProjectAnalyticsResponse.Bucket bucket(List<SprintBacklog> items, LocalDate start,
                                                          LocalDate end, LocalDate windowStart,
                                                          long totalDays, long population) {
        long created = 0;
        long completed = 0;
        long todo = 0;
        long inProgress = 0;
        long review = 0;
        long done = 0;

        for (SprintBacklog item : items) {
            LocalDate createdOn = createdOn(item);
            LocalDate updatedOn = updatedOn(item);
            SprintBacklogStatus status = statusOf(item);

            if (createdOn != null && !createdOn.isBefore(start) && !createdOn.isAfter(end)) {
                created++;
            }
            if (status == SprintBacklogStatus.DONE
                    && updatedOn != null && !updatedOn.isBefore(start) && !updatedOn.isAfter(end)) {
                completed++;
            }

            // Status snapshot at the end of the bucket: an item only exists from
            // its creation date onwards, and a Done item whose last update is
            // after the bucket end was still open back then.
            if (createdOn == null || createdOn.isAfter(end)) {
                continue;
            }
            switch (status) {
                case DONE -> {
                    if (updatedOn != null && updatedOn.isAfter(end)) {
                        inProgress++;
                    } else {
                        done++;
                    }
                }
                case IN_PROGRESS -> inProgress++;
                case REVIEW -> review++;
                default -> todo++;
            }
        }

        long remaining = todo + inProgress + review;
        long elapsed = Math.min(totalDays, ChronoUnit.DAYS.between(windowStart, end) + 1);
        long ideal = Math.round(population * (1.0 - (double) elapsed / totalDays));
        return new ProjectAnalyticsResponse.Bucket(end, created, completed, todo, inProgress, review,
                done, remaining, Math.max(0L, ideal));
    }

    private static LocalDate createdOn(SprintBacklog item) {
        return item.getCreatedAt() == null ? null : item.getCreatedAt().toLocalDate();
    }

    private static LocalDate updatedOn(SprintBacklog item) {
        return item.getUpdatedAt() == null ? null : item.getUpdatedAt().toLocalDate();
    }

    private static SprintBacklogStatus statusOf(SprintBacklog item) {
        return item.getStatus() == null ? SprintBacklogStatus.TODO : item.getStatus();
    }

    // ---------------------------------------------------------------------
    // KPI cards and trend charts
    // ---------------------------------------------------------------------

    /**
     * US-ANL-003: the summary strip above the trend charts.
     *
     * <p>The four cards are computed from the work items that match the applied
     * scope, work item type and the end of the chart window ("as of" the last
     * bucket), so the strip and the burndown agree on how many items are Done:</p>
     * <ol>
     *     <li>Total work items, with the Done / To do split and the estimated
     *     hours split as sub-captions (AC01, AC03).</li>
     *     <li>Completion rate in percent with one decimal (AC01), {@code 0.0%}
     *     when the scope is empty (AC02).</li>
     *     <li>Average cycle time and average lead time in days (AC01),
     *     {@code N/A} when nothing is Done (AC02).</li>
     * </ol>
     */
    private List<ProjectAnalyticsResponse.Kpi> kpis(ProjectAnalyticsScope scope, Sprint sprint,
                                                    List<SprintBacklog> items,
                                                    LocalDate windowStart, LocalDate windowEnd) {
        long done = 0;
        long todo = 0;
        double doneHours = 0;
        double totalHours = 0;
        List<SprintBacklog> doneItems = new ArrayList<>();

        for (SprintBacklog item : items) {
            LocalDate createdOn = createdOn(item);
            // AC01: an item created after the end of the window did not exist
            // yet, so it cannot be part of "as of <windowEnd>" totals.
            if (createdOn != null && createdOn.isAfter(windowEnd)) {
                continue;
            }
            double hours = item.getEstimatedHours() == null ? 0 : Math.max(0, item.getEstimatedHours());
            totalHours += hours;
            if (isDoneAsOf(item, windowEnd)) {
                done++;
                doneHours += hours;
                doneItems.add(item);
            } else {
                todo++;
            }
        }

        long total = done + todo;
        // AC02: 0/0 must render as 0.0%, never as NaN.
        double completionRate = total == 0 ? 0.0 : done * 100.0 / total;

        Map<Long, LocalDate[]> timeline = completionTimeline(doneItems, windowEnd);
        Double averageCycle = averageDays(doneItems, timeline, true);
        Double averageLead = averageDays(doneItems, timeline, false);

        String scopeHint = switch (scope) {
            case BACKLOG -> "Product backlog items without a sprint";
            case SPRINT -> sprint == null || sprint.getName() == null
                    ? "Selected sprint"
                    : "Sprint · " + sprint.getName();
            default -> "All project work items";
        };
        String windowHint = windowStart.equals(windowEnd)
                ? "as of " + windowStart
                : "as of " + windowEnd + " · " + windowStart + " → " + windowEnd;
        String hoursCaption = totalHours > 0
                ? oneDecimal(doneHours) + "h / " + oneDecimal(totalHours) + "h"
                : null;
        String doneCaption = done + " Done / " + todo + " To do";

        // AC02: without a single Done item the averages have no sample at all.
        String measuredCaption = doneItems.isEmpty()
                ? "No Done items in scope yet"
                : doneItems.size() + (doneItems.size() == 1 ? " Done item measured" : " Done items measured");

        return List.of(
                new ProjectAnalyticsResponse.Kpi("total-work-items", "Total work items",
                        Long.toString(total), UNIT_ITEMS, scopeHint + " · " + windowHint,
                        doneCaption, hoursCaption),
                new ProjectAnalyticsResponse.Kpi("completion-rate", "Completion rate",
                        oneDecimal(completionRate) + "%", UNIT_PERCENT,
                        "Done ÷ total work items in scope",
                        done + " of " + total + " items done", hoursCaption),
                new ProjectAnalyticsResponse.Kpi("avg-cycle-time", "Avg cycle time",
                        averageCycle == null ? NOT_AVAILABLE : oneDecimal(averageCycle) + " days",
                        UNIT_DAYS,
                        "Mean days from the first move to In progress until Done",
                        measuredCaption, null),
                new ProjectAnalyticsResponse.Kpi("avg-lead-time", "Avg lead time",
                        averageLead == null ? NOT_AVAILABLE : oneDecimal(averageLead) + " days",
                        UNIT_DAYS,
                        "Mean days from creation until Done",
                        measuredCaption, null));
    }

    /**
     * AC01: an item counts as Done when it is in status Done and its last
     * update happened on or before the end of the window (same rule as the
     * status snapshot of {@link #bucket}).
     */
    private static boolean isDoneAsOf(SprintBacklog item, LocalDate windowEnd) {
        if (statusOf(item) != SprintBacklogStatus.DONE) {
            return false;
        }
        LocalDate updatedOn = updatedOn(item);
        return updatedOn == null || !updatedOn.isAfter(windowEnd);
    }

    /**
     * US-ANL-003: the transition dates of every Done item.
     *
     * <p>Slot {@code [0]} is the first move to In progress (cycle time start),
     * slot {@code [1]} is the first move to Done (both cycle and lead time
     * end). The append-only backlog audit trail is the only place that keeps
     * those dates; items without any history simply fall back to
     * {@code created_at} / {@code updated_at} in {@link #averageDays}.</p>
     */
    private Map<Long, LocalDate[]> completionTimeline(List<SprintBacklog> doneItems, LocalDate windowEnd) {
        Map<Long, LocalDate[]> timeline = new LinkedHashMap<>();
        if (doneItems.isEmpty()) {
            return timeline;
        }
        List<Long> ids = doneItems.stream()
                .map(SprintBacklog::getId)
                .filter(Objects::nonNull)
                .toList();
        if (ids.isEmpty()) {
            return timeline;
        }
        String inProgress = SprintBacklogStatus.IN_PROGRESS.name();
        String doneState = SprintBacklogStatus.DONE.name();
        for (SprintBacklogAuditLog event : workItems.findStatusEvents(ids, windowEnd.atTime(23, 59, 59))) {
            LocalDate on = event.getCreatedAt() == null ? null : event.getCreatedAt().toLocalDate();
            if (on == null || event.getSprintBacklogId() == null) {
                continue;
            }
            String before = statusIn(event.getBeforeState());
            String after = statusIn(event.getAfterState());
            LocalDate[] slot = timeline.computeIfAbsent(event.getSprintBacklogId(), key -> new LocalDate[2]);
            if (inProgress.equals(after) && !inProgress.equals(before)
                    && (slot[0] == null || on.isBefore(slot[0]))) {
                slot[0] = on;
            }
            // Events arrive oldest first, so the first Done transition wins
            // even when a reopened item is completed a second time.
            if (doneState.equals(after) && !doneState.equals(before) && slot[1] == null) {
                slot[1] = on;
            }
        }
        return timeline;
    }

    /**
     * Mean number of whole days spent on the Done items.
     *
     * @param cycle {@code true} measures first In progress → Done, {@code false}
     *              measures creation → Done (lead time)
     * @return {@code null} when no item provides a usable pair of dates
     */
    private static Double averageDays(List<SprintBacklog> doneItems, Map<Long, LocalDate[]> timeline,
                                      boolean cycle) {
        long days = 0;
        int samples = 0;
        for (SprintBacklog item : doneItems) {
            LocalDate createdOn = createdOn(item);
            LocalDate[] slot = item.getId() == null ? null : timeline.get(item.getId());
            LocalDate completedOn = slot != null && slot[1] != null ? slot[1] : updatedOn(item);
            LocalDate startedOn = cycle ? (slot == null ? null : slot[0]) : createdOn;
            // AC02: without a start date the item cannot contribute a sample.
            if (cycle && startedOn == null) {
                startedOn = createdOn;
            }
            if (startedOn == null || completedOn == null) {
                continue;
            }
            days += Math.max(0L, ChronoUnit.DAYS.between(startedOn, completedOn));
            samples++;
        }
        return samples == 0 ? null : (double) days / samples;
    }

    /** Reads the {@code status} field of an audit before/after state snapshot. */
    private String statusIn(String state) {
        if (state == null || state.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(state);
            if (node != null && node.isObject()) {
                JsonNode status = node.get("status");
                return status == null || status.isNull() ? null : status.asText();
            }
            if (node != null && node.isTextual()) {
                return node.asText();
            }
        } catch (JsonProcessingException legacy) {
            // Legacy rows stored the bare status value instead of a snapshot.
        }
        String value = state.trim().toUpperCase(Locale.ROOT);
        return value.matches("[A-Z_]{1,20}") ? value : null;
    }

    /** US-ANL-003: one decimal place, independent of the JVM default locale. */
    private static String oneDecimal(double value) {
        return String.format(Locale.ROOT, "%.1f", value);
    }

    /**
     * US-ANL-004: work items grouped by their creation date, split into Done
     * and To do (AC01 / AC02).
     *
     * <p>The chart is a creation trend, so only the dates inside the effective
     * window that actually received a work item produce a bar; there is no
     * empty bar for a day without creation. The Done / To do split uses the
     * current status with the same "as of the end of the window" rule as the
     * KPI strip, which keeps the two readings consistent and makes a newly
     * completed task move from the green cap to the blue segment on the next
     * refresh (AC03).</p>
     */
    private static ProjectAnalyticsResponse.CreationTrend creationTrend(
            List<SprintBacklog> items, LocalDate windowStart, LocalDate windowEnd) {
        Map<LocalDate, long[]> grouped = new TreeMap<>();
        for (SprintBacklog item : items) {
            LocalDate createdOn = createdOn(item);
            if (createdOn == null || createdOn.isBefore(windowStart) || createdOn.isAfter(windowEnd)) {
                continue;
            }
            long[] split = grouped.computeIfAbsent(createdOn, key -> new long[2]);
            if (isDoneAsOf(item, windowEnd)) {
                split[0]++;
            } else {
                split[1]++;
            }
        }
        List<ProjectAnalyticsResponse.CreationBucket> buckets = grouped.entrySet().stream()
                .map(entry -> new ProjectAnalyticsResponse.CreationBucket(
                        entry.getKey(), entry.getValue()[0], entry.getValue()[1]))
                .toList();
        return new ProjectAnalyticsResponse.CreationTrend(
                buckets.isEmpty() ? STATE_EMPTY : STATE_READY,
                List.of(
                        new ProjectAnalyticsResponse.Series("done", "Done"),
                        new ProjectAnalyticsResponse.Series("todo", "To Do")),
                buckets);
    }

    // ---------------------------------------------------------------------
    // US-ANL-005: work item cycle time trend
    // ---------------------------------------------------------------------

    /** Seconds per day used to express cycle time in (fractional) days. */
    private static final double SECONDS_PER_DAY = 86_400d;

    /**
     * US-ANL-005: average active execution time per completion date.
     *
     * <p>For every work item that is Done (AC03: open items never produce a
     * sample) the status history of the work item activity trail gives:</p>
     * <ul>
     *     <li>start = first transition to In progress; when the item never
     *     entered In progress, the first transition out of To do into another
     *     active state, otherwise {@code created_at} (AC02);</li>
     *     <li>end = the <em>final</em> transition to Done, so a reopened and
     *     re-completed item measures final Done − initial In progress.</li>
     * </ul>
     * <p>Cycle time = (end − start) / 86400 seconds. Samples are grouped by
     * the completion date in the tenant time zone and averaged per day
     * (one decimal, AC01). Only completion dates inside the chart window
     * produce a point; the backend returns them oldest first.</p>
     */
    private ProjectAnalyticsResponse.CycleTimeTrend cycleTimeTrend(
            List<SprintBacklog> items, LocalDate windowStart, LocalDate windowEnd) {
        ZoneId tenantZone = tenantZone();
        ZoneId serverZone = ZoneId.systemDefault();

        // AC03: only items currently in Done can carry a completed cycle.
        List<SprintBacklog> doneItems = items.stream()
                .filter(item -> item.getId() != null)
                .filter(item -> statusOf(item) == SprintBacklogStatus.DONE)
                .toList();

        Map<LocalDate, double[]> grouped = new TreeMap<>();
        if (!doneItems.isEmpty()) {
            // Last instant of windowEnd in the tenant zone, expressed in the
            // server zone the audit timestamps are stored in.
            LocalDateTime asOf = windowEnd.plusDays(1)
                    .atStartOfDay(tenantZone)
                    .withZoneSameInstant(serverZone)
                    .toLocalDateTime()
                    .minusNanos(1);

            Map<Long, List<SprintBacklogAuditLog>> history = new HashMap<>();
            List<Long> ids = doneItems.stream().map(SprintBacklog::getId).toList();
            for (SprintBacklogAuditLog event : workItems.findStatusEvents(ids, asOf)) {
                if (event.getSprintBacklogId() != null) {
                    history.computeIfAbsent(event.getSprintBacklogId(), key -> new ArrayList<>()).add(event);
                }
            }

            for (SprintBacklog item : doneItems) {
                CycleSample sample = cycleSample(item, history.getOrDefault(item.getId(), List.of()), asOf);
                if (sample == null) {
                    continue;
                }
                LocalDate completedOn = sample.completedAt()
                        .atZone(serverZone)
                        .withZoneSameInstant(tenantZone)
                        .toLocalDate();
                if (completedOn.isBefore(windowStart) || completedOn.isAfter(windowEnd)) {
                    continue;
                }
                double[] accumulator = grouped.computeIfAbsent(completedOn, key -> new double[2]);
                accumulator[0] += sample.days();
                accumulator[1]++;
            }
        }

        List<ProjectAnalyticsResponse.CycleTimePoint> points = grouped.entrySet().stream()
                .map(entry -> new ProjectAnalyticsResponse.CycleTimePoint(
                        entry.getKey(),
                        Math.round(entry.getValue()[0] / entry.getValue()[1] * 10.0) / 10.0,
                        (int) entry.getValue()[1]))
                .toList();
        return new ProjectAnalyticsResponse.CycleTimeTrend(
                points.isEmpty() ? STATE_EMPTY : STATE_READY,
                tenantZone.getId(),
                points);
    }

    /**
     * Cycle time sample of one Done item, or {@code null} when the item was not
     * Done as of the end of the window (reopened, or completed later).
     *
     * @param events status history of the item, oldest first, bounded by {@code asOf}
     */
    private CycleSample cycleSample(SprintBacklog item, List<SprintBacklogAuditLog> events, LocalDateTime asOf) {
        String todo = SprintBacklogStatus.TODO.name();
        String inProgress = SprintBacklogStatus.IN_PROGRESS.name();
        String done = SprintBacklogStatus.DONE.name();

        LocalDateTime firstInProgress = null;
        LocalDateTime firstLeftTodo = null;
        LocalDateTime finalDone = null;
        String lastStatus = null;

        for (SprintBacklogAuditLog event : events) {
            LocalDateTime at = event.getCreatedAt();
            String before = statusIn(event.getBeforeState());
            String after = statusIn(event.getAfterState());
            if (at == null || after == null || after.equals(before)) {
                continue;
            }
            if (inProgress.equals(after) && firstInProgress == null) {
                firstInProgress = at;
            }
            // AC02 fallback: first move out of To do into an active state
            // (moving straight to Done is the completion, not the start).
            if (todo.equals(before) && !done.equals(after) && firstLeftTodo == null) {
                firstLeftTodo = at;
            }
            if (done.equals(after)) {
                // Reopened rule: the final Done transition wins.
                finalDone = at;
            }
            lastStatus = after;
        }

        // AC03: reopened (or not yet completed) as of the end of the window.
        if (lastStatus != null && !done.equals(lastStatus)) {
            return null;
        }

        LocalDateTime completedAt = finalDone != null ? finalDone : item.getUpdatedAt();
        if (completedAt == null || completedAt.isAfter(asOf)) {
            return null;
        }
        LocalDateTime startedAt = firstInProgress != null
                ? firstInProgress
                : (firstLeftTodo != null ? firstLeftTodo : item.getCreatedAt());
        if (startedAt == null) {
            return null;
        }
        long seconds = Math.max(0L, Duration.between(startedAt, completedAt).getSeconds());
        return new CycleSample(completedAt, seconds / SECONDS_PER_DAY);
    }

    private ZoneId tenantZone() {
        if (tenantTimeZone != null && !tenantTimeZone.isBlank()) {
            try {
                return ZoneId.of(tenantTimeZone.trim());
            } catch (DateTimeException invalid) {
                // Misconfigured zone: fall back to the server zone below.
            }
        }
        return ZoneId.systemDefault();
    }

    private record CycleSample(LocalDateTime completedAt, double days) { }

    private static List<ProjectAnalyticsResponse.Widget> widgets(String state, String granularity,
                                                                 List<ProjectAnalyticsResponse.Bucket> buckets) {
        String unit = switch (granularity) {
            case "WEEK" -> "week";
            case "MONTH" -> "month";
            default -> "day";
        };
        return List.of(
                new ProjectAnalyticsResponse.Widget("work-items-created", "Created work items",
                        "Work items created per " + unit + " in the selected scope.", state, "BAR",
                        List.of(new ProjectAnalyticsResponse.Series("created", "Created")), buckets),
                new ProjectAnalyticsResponse.Widget("work-items-completed", "Completed work items",
                        "Work items that reached Done per " + unit + " in the selected scope.", state, "BAR",
                        List.of(new ProjectAnalyticsResponse.Series("completed", "Completed")), buckets),
                new ProjectAnalyticsResponse.Widget("status-cumulative-flow", "Status cumulative flow",
                        "Work items per status at the end of each " + unit + ".", state, "AREA",
                        List.of(
                                new ProjectAnalyticsResponse.Series("todo", "To do"),
                                new ProjectAnalyticsResponse.Series("inProgress", "In progress"),
                                new ProjectAnalyticsResponse.Series("review", "Review"),
                                new ProjectAnalyticsResponse.Series("done", "Done")),
                        buckets),
                new ProjectAnalyticsResponse.Widget("sprint-burndown", "Remaining work",
                        "Open work items at the end of each " + unit + " versus the ideal burndown line.",
                        state, "LINE",
                        List.of(
                                new ProjectAnalyticsResponse.Series("remaining", "Remaining"),
                                new ProjectAnalyticsResponse.Series("ideal", "Ideal")),
                        buckets));
    }
}
