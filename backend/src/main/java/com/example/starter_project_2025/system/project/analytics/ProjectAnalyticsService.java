package com.example.starter_project_2025.system.project.analytics;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogWorkType;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

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
        ProjectAnalyticsResponse.Bucket last = buckets.get(buckets.size() - 1);

        List<ProjectAnalyticsResponse.Kpi> kpis =
                kpis(scope, selected, last, buckets, windowStart, windowEnd);
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

    private static List<ProjectAnalyticsResponse.Kpi> kpis(ProjectAnalyticsScope scope, Sprint sprint,
                                                           ProjectAnalyticsResponse.Bucket last,
                                                           List<ProjectAnalyticsResponse.Bucket> buckets,
                                                           LocalDate windowStart, LocalDate windowEnd) {
        long open = last.todo() + last.inProgress() + last.review();
        long total = open + last.done();
        long createdInWindow = buckets.stream().mapToLong(ProjectAnalyticsResponse.Bucket::created).sum();
        long completionRate = total == 0 ? 0 : Math.round(last.done() * 100.0 / total);

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

        return List.of(
                new ProjectAnalyticsResponse.Kpi("work-items", "Work items", total, UNIT_ITEMS,
                        scopeHint + " · " + windowHint),
                new ProjectAnalyticsResponse.Kpi("completed", "Completed", last.done(), UNIT_ITEMS,
                        "Work items in status Done at the end of the window"),
                new ProjectAnalyticsResponse.Kpi("open", "Open", open, UNIT_ITEMS,
                        "To do, in progress or in review at the end of the window"),
                new ProjectAnalyticsResponse.Kpi("completion-rate", "Completion rate", completionRate,
                        UNIT_PERCENT, "Completed ÷ work items"),
                new ProjectAnalyticsResponse.Kpi("created-in-window", "Created in window", createdInWindow,
                        UNIT_ITEMS, "Work items created inside the chart window"));
    }

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
