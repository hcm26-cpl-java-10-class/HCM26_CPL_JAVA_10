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
import com.example.starter_project_2025.system.project.task.Task;
import com.example.starter_project_2025.system.project.task.TaskStatus;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditLog;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
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
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final TenantRepository tenants;
    private final ObjectMapper objectMapper;

    /**
     * US-ANL-005 / US-ANL-009: fallback tenant time zone used when
     * {@code Tenant.timezone} is not set on the tenant record.
     */
    @Value("${app.analytics.tenant-time-zone:${app.notification.backlog-time-zone:Asia/Ho_Chi_Minh}}")
    private String tenantTimeZone;

    /**
     * US-ANL-009 AC04: time zone in which database {@code LocalDateTime} audit
     * columns are stored (empty defaults to the JVM server zone; set to
     * {@code UTC} when timestamps are stored in UTC).
     */
    @Value("${app.analytics.storage-time-zone:${app.member-reminder.audit-time-zone:}}")
    private String storageTimeZone;

    /** US-ANL-001 compatibility: the shell without any filter. */
    public ProjectAnalyticsResponse shell(String rawProjectId) {
        return shell(rawProjectId, ProjectAnalyticsFilter.empty());
    }

    public ProjectAnalyticsResponse shell(String rawProjectId, ProjectAnalyticsFilter requested) {
        ResolvedScope ctx = resolveScope(rawProjectId, requested);

        LocalDate bucketStart = ChronoUnit.DAYS.between(ctx.windowStart(), ctx.windowEnd()) >= MAX_WINDOW_DAYS
                ? ctx.windowEnd().minusDays(MAX_WINDOW_DAYS - 1L)
                : ctx.windowStart();
        LocalDate resolvedEnd = ctx.windowEnd();
        long population = ctx.items().stream()
                .map(item -> createdOn(item, ctx.serverZone(), ctx.tenantZone()))
                .filter(Objects::nonNull)
                .filter(date -> !date.isAfter(resolvedEnd))
                .count();
        String granularity = granularityOf(bucketStart, ctx.windowEnd());
        List<ProjectAnalyticsResponse.Bucket> buckets = buckets(
                ctx.items(), bucketStart, ctx.windowEnd(), granularity, population,
                ctx.serverZone(), ctx.tenantZone());

        List<ProjectAnalyticsResponse.Kpi> kpis = kpis(
                ctx.scope(), ctx.selected(), ctx.items(), ctx.windowStart(), ctx.windowEnd(),
                ctx.serverZone(), ctx.tenantZone(), ctx.completionCutoff());
        ProjectAnalyticsResponse.CreationTrend creationTrend = creationTrend(
                ctx.items(), ctx.subtasks(), ctx.backlogHistory(), ctx.subtaskHistory(),
                ctx.windowStart(), ctx.windowEnd(), ctx.tenantZone(), ctx.serverZone(), ctx.completionCutoff());
        ProjectAnalyticsResponse.CycleTimeTrend cycleTimeTrend = cycleTimeTrend(
                ctx.doneBacklogItems(), ctx.backlogHistory(),
                ctx.windowStart(), ctx.windowEnd(), ctx.tenantZone(), ctx.serverZone(), ctx.completionCutoff());
        ProjectAnalyticsResponse.LeadTimeTrend leadTimeTrend = leadTimeTrend(
                ctx.doneBacklogItems(), ctx.doneSubtasks(), ctx.backlogHistory(), ctx.subtaskHistory(),
                ctx.windowStart(), ctx.windowEnd(), ctx.tenantZone(), ctx.serverZone(), ctx.completionCutoff());
        ProjectAnalyticsResponse.CompletionTrend completionTrend = completionTrend(
                ctx.doneBacklogItems(), ctx.doneSubtasks(), ctx.backlogHistory(), ctx.subtaskHistory(),
                ctx.windowStart(), ctx.windowEnd(), ctx.tenantZone(), ctx.serverZone(), ctx.completionCutoff());
        List<ProjectAnalyticsResponse.Widget> widgets =
                widgets(ctx.items().isEmpty() ? STATE_EMPTY : STATE_READY, granularity, buckets);

        return new ProjectAnalyticsResponse(
                ctx.project().getId(),
                ctx.project().getCode(),
                ctx.project().getName(),
                ctx.project().getStatus() == null ? null : ctx.project().getStatus().name(),
                true,
                new ProjectAnalyticsResponse.Filters(
                        ctx.scope().name(),
                        ctx.selected() == null ? null : ctx.selected().getId(),
                        ctx.workType() == null ? ANY_ITEM_TYPE : ctx.workType().name(),
                        ctx.requestedStart(),
                        ctx.requestedEnd(),
                        sprintOptions(ctx.projectSprints(), workItems.countWorkItemsBySprint(ctx.project().getId())),
                        ctx.activeSprint() == null ? null : ctx.activeSprint().getId(),
                        workItems.countProductBacklog(ctx.project().getId()),
                        ITEM_TYPES),
                new ProjectAnalyticsResponse.Window(
                        ctx.windowStart(), ctx.windowEnd(), granularity, ctx.tenantZone().getId()),
                kpis,
                creationTrend,
                cycleTimeTrend,
                leadTimeTrend,
                completionTrend,
                widgets);
    }

    /**
     * US-ANL-008: click-to-drill-down work item list for one date bucket /
     * marker of any of the four analytics charts, honouring the caller's
     * project authorization and active filter scope.
     */
    public ProjectAnalyticsDrillDownResponse drillDown(
            String rawProjectId,
            ProjectAnalyticsFilter requested,
            String rawChart,
            LocalDate date,
            String rawSeries) {
        String chart = parseDrillDownChart(rawChart);
        if (date == null) {
            throw new ProjectAnalyticsValidationException("date", "A date is required to inspect work items");
        }
        String series = normalizeSeries(rawSeries);
        ResolvedScope ctx = resolveScope(rawProjectId, requested);

        String codePrefix = projectPrefix(ctx.project().getCode(), ctx.project().getName());
        Map<Long, String> sprintNames = ctx.projectSprints().stream()
                .filter(sprint -> sprint.getId() != null)
                .collect(Collectors.toMap(Sprint::getId, Sprint::getName, (first, ignored) -> first));

        List<SprintBacklog> matchedBacklogs = new ArrayList<>();
        List<Task> matchedSubtasks = new ArrayList<>();
        Map<Long, TimeSample> backlogCycleSamples = new HashMap<>();
        Map<Long, TimeSample> backlogLeadSamples = new HashMap<>();
        Map<Long, LocalDate> backlogCompletedDates = new HashMap<>();
        Map<UUID, TimeSample> subtaskCycleSamples = new HashMap<>();
        Map<UUID, TimeSample> subtaskLeadSamples = new HashMap<>();
        Map<UUID, LocalDate> subtaskCompletedDates = new HashMap<>();

        switch (chart) {
            case "creation" -> {
                for (SprintBacklog item : ctx.items()) {
                    LocalDate created = createdOn(item, ctx.serverZone(), ctx.tenantZone());
                    if (!date.equals(created)) {
                        continue;
                    }
                    List<SprintBacklogAuditLog> events = item.getId() == null
                            ? List.of() : ctx.backlogHistory().getOrDefault(item.getId(), List.of());
                    LocalDate completedOn = backlogCompletedOn(
                            item, events, ctx.completionCutoff(), ctx.serverZone(), ctx.tenantZone());
                    boolean isDone = completedOn != null && !completedOn.isAfter(ctx.windowEnd());
                    if ("done".equals(series) && !isDone) {
                        continue;
                    }
                    if ("todo".equals(series) && isDone) {
                        continue;
                    }
                    matchedBacklogs.add(item);
                    if (isDone && item.getId() != null) {
                        backlogCompletedDates.put(item.getId(), completedOn);
                        TimeSample cycle = cycleSample(item, events, ctx.completionCutoff());
                        TimeSample lead = backlogLeadSample(item, events, ctx.completionCutoff());
                        if (cycle != null) backlogCycleSamples.put(item.getId(), cycle);
                        if (lead != null) backlogLeadSamples.put(item.getId(), lead);
                    }
                }
                for (Task subtask : ctx.subtasks()) {
                    LocalDate created = subtaskCreatedOn(subtask, ctx.serverZone(), ctx.tenantZone());
                    if (!date.equals(created)) {
                        continue;
                    }
                    List<TaskAuditLog> events = subtask.getId() == null
                            ? List.of() : ctx.subtaskHistory().getOrDefault(subtask.getId(), List.of());
                    LocalDate completedOn = subtaskCompletedOn(
                            subtask, events, ctx.completionCutoff(), ctx.serverZone(), ctx.tenantZone());
                    boolean isDone = completedOn != null && !completedOn.isAfter(ctx.windowEnd());
                    if ("done".equals(series) && !isDone) {
                        continue;
                    }
                    if ("todo".equals(series) && isDone) {
                        continue;
                    }
                    matchedSubtasks.add(subtask);
                    if (isDone && subtask.getId() != null) {
                        subtaskCompletedDates.put(subtask.getId(), completedOn);
                        TimeSample cycle = subtaskCycleSample(subtask, events, ctx.completionCutoff());
                        TimeSample lead = subtaskLeadSample(subtask, events, ctx.completionCutoff());
                        if (cycle != null) subtaskCycleSamples.put(subtask.getId(), cycle);
                        if (lead != null) subtaskLeadSamples.put(subtask.getId(), lead);
                    }
                }
            }
            case "cycle-time" -> {
                for (SprintBacklog item : ctx.doneBacklogItems()) {
                    List<SprintBacklogAuditLog> events = ctx.backlogHistory().getOrDefault(item.getId(), List.of());
                    TimeSample cycle = cycleSample(item, events, ctx.completionCutoff());
                    if (cycle == null) {
                        continue;
                    }
                    LocalDate completedOn = toTenantDate(cycle.completedAt(), ctx.serverZone(), ctx.tenantZone());
                    if (!date.equals(completedOn)) {
                        continue;
                    }
                    matchedBacklogs.add(item);
                    backlogCompletedDates.put(item.getId(), completedOn);
                    backlogCycleSamples.put(item.getId(), cycle);
                    TimeSample lead = backlogLeadSample(item, events, ctx.completionCutoff());
                    if (lead != null) {
                        backlogLeadSamples.put(item.getId(), lead);
                    }
                }
            }
            case "lead-time" -> {
                if (series == null || "story".equals(series) || "task".equals(series)) {
                    for (SprintBacklog item : ctx.doneBacklogItems()) {
                        SprintBacklogWorkType type = item.getWorkType() == null
                                ? SprintBacklogWorkType.DEFAULT : item.getWorkType();
                        if (type != SprintBacklogWorkType.STORY && type != SprintBacklogWorkType.TASK) {
                            continue;
                        }
                        if ("story".equals(series) && type != SprintBacklogWorkType.STORY) {
                            continue;
                        }
                        if ("task".equals(series) && type != SprintBacklogWorkType.TASK) {
                            continue;
                        }
                        List<SprintBacklogAuditLog> events = ctx.backlogHistory().getOrDefault(item.getId(), List.of());
                        TimeSample lead = backlogLeadSample(item, events, ctx.completionCutoff());
                        if (lead == null) {
                            continue;
                        }
                        LocalDate completedOn = toTenantDate(lead.completedAt(), ctx.serverZone(), ctx.tenantZone());
                        if (!date.equals(completedOn)) {
                            continue;
                        }
                        matchedBacklogs.add(item);
                        backlogCompletedDates.put(item.getId(), completedOn);
                        backlogLeadSamples.put(item.getId(), lead);
                        TimeSample cycle = cycleSample(item, events, ctx.completionCutoff());
                        if (cycle != null) {
                            backlogCycleSamples.put(item.getId(), cycle);
                        }
                    }
                }
                if (series == null || "subtask".equals(series)) {
                    for (Task subtask : ctx.doneSubtasks()) {
                        List<TaskAuditLog> events = ctx.subtaskHistory().getOrDefault(subtask.getId(), List.of());
                        TimeSample lead = subtaskLeadSample(subtask, events, ctx.completionCutoff());
                        if (lead == null) {
                            continue;
                        }
                        LocalDate completedOn = toTenantDate(lead.completedAt(), ctx.serverZone(), ctx.tenantZone());
                        if (!date.equals(completedOn)) {
                            continue;
                        }
                        matchedSubtasks.add(subtask);
                        subtaskCompletedDates.put(subtask.getId(), completedOn);
                        subtaskLeadSamples.put(subtask.getId(), lead);
                        TimeSample cycle = subtaskCycleSample(subtask, events, ctx.completionCutoff());
                        if (cycle != null) {
                            subtaskCycleSamples.put(subtask.getId(), cycle);
                        }
                    }
                }
            }
            case "completion" -> {
                if (series == null || "story".equals(series) || "task".equals(series)) {
                    for (SprintBacklog item : ctx.doneBacklogItems()) {
                        boolean isStory = item.getWorkType() == SprintBacklogWorkType.STORY;
                        if ("story".equals(series) && !isStory) {
                            continue;
                        }
                        if ("task".equals(series) && isStory) {
                            continue;
                        }
                        List<SprintBacklogAuditLog> events = ctx.backlogHistory().getOrDefault(item.getId(), List.of());
                        LocalDate completedOn = backlogCompletedOn(
                                item, events, ctx.completionCutoff(), ctx.serverZone(), ctx.tenantZone());
                        if (!date.equals(completedOn)) {
                            continue;
                        }
                        matchedBacklogs.add(item);
                        backlogCompletedDates.put(item.getId(), completedOn);
                        TimeSample cycle = cycleSample(item, events, ctx.completionCutoff());
                        TimeSample lead = backlogLeadSample(item, events, ctx.completionCutoff());
                        if (cycle != null) backlogCycleSamples.put(item.getId(), cycle);
                        if (lead != null) backlogLeadSamples.put(item.getId(), lead);
                    }
                }
                if (series == null || "subtask".equals(series)) {
                    for (Task subtask : ctx.doneSubtasks()) {
                        List<TaskAuditLog> events = ctx.subtaskHistory().getOrDefault(subtask.getId(), List.of());
                        LocalDate completedOn = subtaskCompletedOn(
                                subtask, events, ctx.completionCutoff(), ctx.serverZone(), ctx.tenantZone());
                        if (!date.equals(completedOn)) {
                            continue;
                        }
                        matchedSubtasks.add(subtask);
                        subtaskCompletedDates.put(subtask.getId(), completedOn);
                        TimeSample cycle = subtaskCycleSample(subtask, events, ctx.completionCutoff());
                        TimeSample lead = subtaskLeadSample(subtask, events, ctx.completionCutoff());
                        if (cycle != null) subtaskCycleSamples.put(subtask.getId(), cycle);
                        if (lead != null) subtaskLeadSamples.put(subtask.getId(), lead);
                    }
                }
            }
            default -> throw new ProjectAnalyticsValidationException("chart",
                    "Chart must be one of creation, cycle-time, lead-time or completion");
        }

        Set<Long> memberIds = matchedBacklogs.stream()
                .map(SprintBacklog::getAssigneeProjectMemberId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, String> backlogAssignees = workItems.findAssigneeNames(memberIds);

        Set<UUID> subtaskAssigneeIds = matchedSubtasks.stream()
                .map(Task::getAssigneeProjectMemberId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, String> subtaskAssignees = workItems.findSubtaskAssigneeNames(subtaskAssigneeIds);

        List<ProjectAnalyticsDrillDownResponse.WorkItem> rows = new ArrayList<>(
                matchedBacklogs.size() + matchedSubtasks.size());
        for (SprintBacklog item : matchedBacklogs) {
            Long id = item.getId();
            Long sprintId = item.getSprint() == null ? null : item.getSprint().getId();
            SprintBacklogWorkType type = item.getWorkType() == null
                    ? SprintBacklogWorkType.DEFAULT : item.getWorkType();
            TimeSample cycle = id == null ? null : backlogCycleSamples.get(id);
            TimeSample lead = id == null ? null : backlogLeadSamples.get(id);
            rows.add(new ProjectAnalyticsDrillDownResponse.WorkItem(
                    id == null ? "" : id.toString(),
                    id,
                    codePrefix + "-" + (id == null ? "?" : id),
                    item.getTitle(),
                    type.name(),
                    statusOf(item).name(),
                    item.getAssigneeProjectMemberId() == null
                            ? null : backlogAssignees.get(item.getAssigneeProjectMemberId()),
                    sprintId,
                    sprintId == null ? null : sprintNames.get(sprintId),
                    createdOn(item, ctx.serverZone(), ctx.tenantZone()),
                    id == null ? null : backlogCompletedDates.get(id),
                    cycle == null ? null : roundOneDecimal(cycle.days()),
                    lead == null ? null : roundOneDecimal(lead.days())));
        }
        for (Task subtask : matchedSubtasks) {
            UUID id = subtask.getId();
            SprintBacklog parent = subtask.getBacklogItem();
            Long parentId = parent == null ? null : parent.getId();
            Long sprintId = parent == null || parent.getSprint() == null ? null : parent.getSprint().getId();
            String shortId = id == null ? "?" : id.toString().substring(0, 4).toUpperCase(Locale.ROOT);
            String taskCode = parentId != null
                    ? codePrefix + "-" + parentId + " · SUB-" + shortId
                    : "SUB-" + shortId;
            TimeSample cycle = id == null ? null : subtaskCycleSamples.get(id);
            TimeSample lead = id == null ? null : subtaskLeadSamples.get(id);
            rows.add(new ProjectAnalyticsDrillDownResponse.WorkItem(
                    id == null ? "" : id.toString(),
                    parentId,
                    taskCode,
                    subtask.getTitle(),
                    "SUBTASK",
                    subtask.getStatus() == null ? TaskStatus.TODO.name() : subtask.getStatus().name(),
                    subtask.getAssigneeProjectMemberId() == null
                            ? null : subtaskAssignees.get(subtask.getAssigneeProjectMemberId()),
                    sprintId,
                    sprintId == null ? null : sprintNames.get(sprintId),
                    subtaskCreatedOn(subtask, ctx.serverZone(), ctx.tenantZone()),
                    id == null ? null : subtaskCompletedDates.get(id),
                    cycle == null ? null : roundOneDecimal(cycle.days()),
                    lead == null ? null : roundOneDecimal(lead.days())));
        }

        if ("cycle-time".equals(chart)) {
            rows.sort(Comparator.comparing(
                    ProjectAnalyticsDrillDownResponse.WorkItem::cycleDays,
                    Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(ProjectAnalyticsDrillDownResponse.WorkItem::taskCode));
        } else if ("lead-time".equals(chart)) {
            rows.sort(Comparator.comparing(
                    ProjectAnalyticsDrillDownResponse.WorkItem::leadDays,
                    Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(ProjectAnalyticsDrillDownResponse.WorkItem::taskCode));
        } else {
            rows.sort(Comparator.comparing(ProjectAnalyticsDrillDownResponse.WorkItem::taskCode));
        }

        return new ProjectAnalyticsDrillDownResponse(
                ctx.project().getId(),
                ctx.project().getCode(),
                chart,
                date,
                series,
                rows.size(),
                rows);
    }

    private ResolvedScope resolveScope(String rawProjectId, ProjectAnalyticsFilter requested) {
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
        List<Long> scopeBacklogIds = items.stream()
                .map(SprintBacklog::getId)
                .filter(Objects::nonNull)
                .toList();
        List<Task> subtasks = workType == null
                ? workItems.findSubtasks(scopeBacklogIds)
                : List.of();

        ZoneId tenantZone = tenantZone(user, project);
        ZoneId serverZone = storageZone();

        LocalDate windowStart = resolveWindowStart(requestedStart, items, subtasks, serverZone, tenantZone);
        LocalDate windowEnd = resolveWindowEnd(requestedEnd, items, subtasks, serverZone, tenantZone);
        if (windowEnd.isBefore(windowStart)) {
            windowEnd = windowStart;
        }
        if ((requestedStart != null || requestedEnd != null)
                && ChronoUnit.DAYS.between(windowStart, windowEnd) >= MAX_WINDOW_DAYS) {
            windowStart = windowEnd.minusDays(MAX_WINDOW_DAYS - 1L);
        }

        LocalDateTime completionCutoff = completionCutoff(windowEnd, tenantZone, serverZone);
        List<SprintBacklog> doneBacklogItems = items.stream()
                .filter(item -> item.getId() != null)
                .filter(item -> statusOf(item) == SprintBacklogStatus.DONE)
                .toList();
        Map<Long, List<SprintBacklogAuditLog>> backlogHistory =
                backlogStatusHistory(doneBacklogItems, completionCutoff);
        List<Task> doneSubtasks = subtasks.stream()
                .filter(subtask -> subtask.getId() != null)
                .filter(subtask -> subtask.getStatus() == TaskStatus.DONE)
                .toList();
        Map<UUID, List<TaskAuditLog>> subtaskHistory =
                subtaskStatusHistory(doneSubtasks, completionCutoff);

        return new ResolvedScope(
                project, scope, selected, workType, requestedStart, requestedEnd,
                projectSprints, activeSprint, items, subtasks,
                doneBacklogItems, doneSubtasks, backlogHistory, subtaskHistory,
                windowStart, windowEnd, tenantZone, serverZone, completionCutoff);
    }

    private static String parseDrillDownChart(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ProjectAnalyticsValidationException("chart",
                    "Chart must be one of creation, cycle-time, lead-time or completion");
        }
        String value = raw.trim().toLowerCase(Locale.ROOT);
        if (Set.of("creation", "cycle-time", "lead-time", "completion").contains(value)) {
            return value;
        }
        throw new ProjectAnalyticsValidationException("chart",
                "Chart must be one of creation, cycle-time, lead-time or completion");
    }

    private static String normalizeSeries(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim().toLowerCase(Locale.ROOT);
        return "all".equals(value) ? null : value;
    }

    private static String projectPrefix(String code, String name) {
        if (code != null && !code.isBlank()) {
            return code.trim().toUpperCase(Locale.ROOT);
        }
        if (name != null && !name.isBlank()) {
            String letters = name.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
            if (!letters.isEmpty()) {
                return letters.substring(0, Math.min(3, letters.length()));
            }
        }
        return "PRJ";
    }

    private record ResolvedScope(
            Project project,
            ProjectAnalyticsScope scope,
            Sprint selected,
            SprintBacklogWorkType workType,
            LocalDate requestedStart,
            LocalDate requestedEnd,
            List<Sprint> projectSprints,
            Sprint activeSprint,
            List<SprintBacklog> items,
            List<Task> subtasks,
            List<SprintBacklog> doneBacklogItems,
            List<Task> doneSubtasks,
            Map<Long, List<SprintBacklogAuditLog>> backlogHistory,
            Map<UUID, List<TaskAuditLog>> subtaskHistory,
            LocalDate windowStart,
            LocalDate windowEnd,
            ZoneId tenantZone,
            ZoneId serverZone,
            LocalDateTime completionCutoff
    ) { }

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

    private static LocalDate resolveWindowStart(LocalDate requested, List<SprintBacklog> items,
                                                List<Task> subtasks, ZoneId serverZone, ZoneId tenantZone) {
        if (requested != null) {
            return requested;
        }
        LocalDate earliest = null;
        for (SprintBacklog item : items) {
            earliest = earlierOf(earliest, createdOn(item, serverZone, tenantZone));
        }
        for (Task subtask : subtasks) {
            earliest = earlierOf(earliest, subtaskCreatedOn(subtask, serverZone, tenantZone));
        }
        return earliest != null ? earliest : LocalDate.now(tenantZone).minusDays(DEFAULT_WINDOW_DAYS - 1L);
    }

    private static LocalDate resolveWindowEnd(LocalDate requested, List<SprintBacklog> items,
                                              List<Task> subtasks, ZoneId serverZone, ZoneId tenantZone) {
        if (requested != null) {
            return requested;
        }
        LocalDate latest = LocalDate.now(tenantZone);
        for (SprintBacklog item : items) {
            latest = laterOf(latest, updatedOn(item, serverZone, tenantZone));
            latest = laterOf(latest, createdOn(item, serverZone, tenantZone));
        }
        for (Task subtask : subtasks) {
            latest = laterOf(latest, subtaskUpdatedOn(subtask, serverZone, tenantZone));
            latest = laterOf(latest, subtaskCreatedOn(subtask, serverZone, tenantZone));
        }
        return latest;
    }

    private static LocalDate earlierOf(LocalDate current, LocalDate candidate) {
        if (candidate == null) {
            return current;
        }
        return current == null || candidate.isBefore(current) ? candidate : current;
    }

    private static LocalDate laterOf(LocalDate current, LocalDate candidate) {
        if (candidate == null) {
            return current;
        }
        return current == null || candidate.isAfter(current) ? candidate : current;
    }

    private static String granularityOf(LocalDate start, LocalDate end) {
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        if (days <= DAY_BUCKET_LIMIT_DAYS) {
            return "DAY";
        }
        return days <= WEEK_BUCKET_LIMIT_DAYS ? "WEEK" : "MONTH";
    }

    private List<ProjectAnalyticsResponse.Bucket> buckets(List<SprintBacklog> items, LocalDate start,
                                                          LocalDate end, String granularity, long population,
                                                          ZoneId serverZone, ZoneId tenantZone) {
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
            buckets.add(bucket(items, bucketStart, bucketEnd, start, totalDays, population, serverZone, tenantZone));
            cursor = next;
        }
        return buckets;
    }

    private static ProjectAnalyticsResponse.Bucket bucket(List<SprintBacklog> items, LocalDate start,
                                                          LocalDate end, LocalDate windowStart,
                                                          long totalDays, long population,
                                                          ZoneId serverZone, ZoneId tenantZone) {
        long created = 0;
        long completed = 0;
        long todo = 0;
        long inProgress = 0;
        long review = 0;
        long done = 0;

        for (SprintBacklog item : items) {
            LocalDate createdOn = createdOn(item, serverZone, tenantZone);
            LocalDate updatedOn = updatedOn(item, serverZone, tenantZone);
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

    private static LocalDate createdOn(SprintBacklog item, ZoneId serverZone, ZoneId tenantZone) {
        return item.getCreatedAt() == null ? null : toTenantDate(item.getCreatedAt(), serverZone, tenantZone);
    }

    private static LocalDate updatedOn(SprintBacklog item, ZoneId serverZone, ZoneId tenantZone) {
        return item.getUpdatedAt() == null ? null : toTenantDate(item.getUpdatedAt(), serverZone, tenantZone);
    }

    private static LocalDate subtaskCreatedOn(Task subtask, ZoneId serverZone, ZoneId tenantZone) {
        return subtask.getCreatedAt() == null ? null : toTenantDate(subtask.getCreatedAt(), serverZone, tenantZone);
    }

    private static LocalDate subtaskUpdatedOn(Task subtask, ZoneId serverZone, ZoneId tenantZone) {
        return subtask.getUpdatedAt() == null ? null : toTenantDate(subtask.getUpdatedAt(), serverZone, tenantZone);
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
                                                    LocalDate windowStart, LocalDate windowEnd,
                                                    ZoneId serverZone, ZoneId tenantZone,
                                                    LocalDateTime completionCutoff) {
        long done = 0;
        long todo = 0;
        double doneHours = 0;
        double totalHours = 0;
        List<SprintBacklog> doneItems = new ArrayList<>();

        for (SprintBacklog item : items) {
            LocalDate createdOn = createdOn(item, serverZone, tenantZone);
            // AC01: an item created after the end of the window did not exist
            // yet, so it cannot be part of "as of <windowEnd>" totals.
            if (createdOn != null && createdOn.isAfter(windowEnd)) {
                continue;
            }
            double hours = item.getEstimatedHours() == null ? 0 : Math.max(0, item.getEstimatedHours());
            totalHours += hours;
            if (isDoneAsOf(item, windowEnd, serverZone, tenantZone)) {
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

        Map<Long, LocalDate[]> timeline = completionTimeline(doneItems, completionCutoff, serverZone, tenantZone);
        Double averageCycle = averageDays(doneItems, timeline, true, serverZone, tenantZone);
        Double averageLead = averageDays(doneItems, timeline, false, serverZone, tenantZone);

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
    private static boolean isDoneAsOf(SprintBacklog item, LocalDate windowEnd,
                                      ZoneId serverZone, ZoneId tenantZone) {
        if (statusOf(item) != SprintBacklogStatus.DONE) {
            return false;
        }
        LocalDate updatedOn = updatedOn(item, serverZone, tenantZone);
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
    private Map<Long, LocalDate[]> completionTimeline(List<SprintBacklog> doneItems,
                                                      LocalDateTime completionCutoff,
                                                      ZoneId serverZone, ZoneId tenantZone) {
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
        for (SprintBacklogAuditLog event : workItems.findStatusEvents(ids, completionCutoff)) {
            LocalDate on = event.getCreatedAt() == null
                    ? null : toTenantDate(event.getCreatedAt(), serverZone, tenantZone);
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
                                      boolean cycle, ZoneId serverZone, ZoneId tenantZone) {
        long days = 0;
        int samples = 0;
        for (SprintBacklog item : doneItems) {
            LocalDate createdOn = createdOn(item, serverZone, tenantZone);
            LocalDate[] slot = item.getId() == null ? null : timeline.get(item.getId());
            LocalDate completedOn = slot != null && slot[1] != null
                    ? slot[1] : updatedOn(item, serverZone, tenantZone);
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
     * and To do (AC01 / AC02), reconciled with US-ANL-007 completion totals.
     *
     * <p>The chart is a creation trend, so only the dates inside the effective
     * window that actually received a work item produce a bar; there is no
     * empty bar for a day without creation. Both backlog items and in-scope
     * subtasks use the same completion cutoff and reopened rule as
     * {@link #completionTrend}, so with no date restriction the Done total of
     * this chart matches the sum of all bars in the completion trend (US-ANL-007 AC02).</p>
     */
    private ProjectAnalyticsResponse.CreationTrend creationTrend(
            List<SprintBacklog> items,
            List<Task> subtasks,
            Map<Long, List<SprintBacklogAuditLog>> backlogHistory,
            Map<UUID, List<TaskAuditLog>> subtaskHistory,
            LocalDate windowStart,
            LocalDate windowEnd,
            ZoneId tenantZone,
            ZoneId serverZone,
            LocalDateTime asOf) {
        Map<LocalDate, long[]> grouped = new TreeMap<>();
        for (SprintBacklog item : items) {
            LocalDate createdOn = createdOn(item, serverZone, tenantZone);
            if (createdOn == null || createdOn.isBefore(windowStart) || createdOn.isAfter(windowEnd)) {
                continue;
            }
            long[] split = grouped.computeIfAbsent(createdOn, key -> new long[2]);
            LocalDate completedOn = backlogCompletedOn(
                    item,
                    item.getId() == null ? List.of() : backlogHistory.getOrDefault(item.getId(), List.of()),
                    asOf, serverZone, tenantZone);
            if (completedOn != null && !completedOn.isAfter(windowEnd)) {
                split[0]++;
            } else {
                split[1]++;
            }
        }
        for (Task subtask : subtasks) {
            LocalDate createdOn = subtaskCreatedOn(subtask, serverZone, tenantZone);
            if (createdOn == null || createdOn.isBefore(windowStart) || createdOn.isAfter(windowEnd)) {
                continue;
            }
            long[] split = grouped.computeIfAbsent(createdOn, key -> new long[2]);
            LocalDate completedOn = subtaskCompletedOn(
                    subtask,
                    subtask.getId() == null ? List.of() : subtaskHistory.getOrDefault(subtask.getId(), List.of()),
                    asOf, serverZone, tenantZone);
            if (completedOn != null && !completedOn.isAfter(windowEnd)) {
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
                tenantZone.getId(),
                List.of(
                        new ProjectAnalyticsResponse.Series("done", "Done"),
                        new ProjectAnalyticsResponse.Series("todo", "To Do")),
                buckets);
    }

    // ---------------------------------------------------------------------
    // US-ANL-005 / US-ANL-006 / US-ANL-007: cycle time, lead time & completion trends
    // ---------------------------------------------------------------------

    /** Seconds per day used to express cycle and lead time in (fractional) days. */
    private static final double SECONDS_PER_DAY = 86_400d;

    /** US-ANL-006: ordered legend metadata for the multi-series lead time chart. */
    private static final List<ProjectAnalyticsResponse.Series> LEAD_TIME_SERIES = List.of(
            new ProjectAnalyticsResponse.Series("story", "Story"),
            new ProjectAnalyticsResponse.Series("subtask", "Subtask"),
            new ProjectAnalyticsResponse.Series("task", "Task"));

    private static LocalDateTime completionCutoff(LocalDate windowEnd, ZoneId tenantZone, ZoneId serverZone) {
        return windowEnd.plusDays(1)
                .atStartOfDay(tenantZone)
                .withZoneSameInstant(serverZone)
                .toLocalDateTime()
                .minusNanos(1);
    }

    private static LocalDate toTenantDate(LocalDateTime timestamp, ZoneId serverZone, ZoneId tenantZone) {
        return timestamp.atZone(serverZone).withZoneSameInstant(tenantZone).toLocalDate();
    }

    private static double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private Map<Long, List<SprintBacklogAuditLog>> backlogStatusHistory(
            List<SprintBacklog> doneItems, LocalDateTime asOf) {
        Map<Long, List<SprintBacklogAuditLog>> history = new HashMap<>();
        if (doneItems.isEmpty()) {
            return history;
        }
        List<Long> ids = doneItems.stream().map(SprintBacklog::getId).toList();
        for (SprintBacklogAuditLog event : workItems.findStatusEvents(ids, asOf)) {
            if (event.getSprintBacklogId() != null) {
                history.computeIfAbsent(event.getSprintBacklogId(), key -> new ArrayList<>()).add(event);
            }
        }
        return history;
    }

    private Map<UUID, List<TaskAuditLog>> subtaskStatusHistory(
            List<Task> doneSubtasks, LocalDateTime asOf) {
        Map<UUID, List<TaskAuditLog>> history = new HashMap<>();
        if (doneSubtasks.isEmpty()) {
            return history;
        }
        List<UUID> ids = doneSubtasks.stream().map(Task::getId).toList();
        for (TaskAuditLog event : workItems.findSubtaskStatusEvents(ids, asOf)) {
            if (event.getTaskId() != null) {
                history.computeIfAbsent(event.getTaskId(), key -> new ArrayList<>()).add(event);
            }
        }
        return history;
    }

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
            List<SprintBacklog> doneItems,
            Map<Long, List<SprintBacklogAuditLog>> history,
            LocalDate windowStart,
            LocalDate windowEnd,
            ZoneId tenantZone,
            ZoneId serverZone,
            LocalDateTime asOf) {
        Map<LocalDate, double[]> grouped = new TreeMap<>();
        for (SprintBacklog item : doneItems) {
            TimeSample sample = cycleSample(item, history.getOrDefault(item.getId(), List.of()), asOf);
            if (sample == null) {
                continue;
            }
            LocalDate completedOn = toTenantDate(sample.completedAt(), serverZone, tenantZone);
            if (completedOn.isBefore(windowStart) || completedOn.isAfter(windowEnd)) {
                continue;
            }
            double[] accumulator = grouped.computeIfAbsent(completedOn, key -> new double[2]);
            accumulator[0] += sample.days();
            accumulator[1]++;
        }

        List<ProjectAnalyticsResponse.CycleTimePoint> points = grouped.entrySet().stream()
                .map(entry -> new ProjectAnalyticsResponse.CycleTimePoint(
                        entry.getKey(),
                        roundOneDecimal(entry.getValue()[0] / entry.getValue()[1]),
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
    private TimeSample cycleSample(SprintBacklog item, List<SprintBacklogAuditLog> events, LocalDateTime asOf) {
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
        // US-ANL-006 AC03: execution start cannot precede creation, preserving
        // Lead Time >= Cycle Time even if an audit timestamp is backdated.
        if (item.getCreatedAt() != null && startedAt.isBefore(item.getCreatedAt())) {
            startedAt = item.getCreatedAt();
        }
        long seconds = Math.max(0L, Duration.between(startedAt, completedAt).getSeconds());
        return new TimeSample(completedAt, seconds / SECONDS_PER_DAY);
    }

    /**
     * US-ANL-006: average end-to-end lead time per {@code (completed_date, work_item_type)}
     * across Story, Subtask and Task items.
     *
     * <p>Lead Time = {@code (t_DONE - created_at) / 86400} seconds. Story and
     * Task samples come from completed {@code SprintBacklog} items; Subtask
     * samples come from completed {@code ProjectTask} subtasks linked to any
     * in-scope backlog item (when no specific backlog work type filter excludes
     * subtasks). Dates with zero completions of a type leave that series
     * {@code null} instead of plotting false zero values (AC02).</p>
     */
    private ProjectAnalyticsResponse.LeadTimeTrend leadTimeTrend(
            List<SprintBacklog> doneBacklogItems,
            List<Task> doneSubtasks,
            Map<Long, List<SprintBacklogAuditLog>> backlogHistory,
            Map<UUID, List<TaskAuditLog>> subtaskHistory,
            LocalDate windowStart,
            LocalDate windowEnd,
            ZoneId tenantZone,
            ZoneId serverZone,
            LocalDateTime asOf) {
        Map<LocalDate, LeadAccumulator> grouped = new TreeMap<>();

        for (SprintBacklog item : doneBacklogItems) {
            SprintBacklogWorkType type = item.getWorkType() == null
                    ? SprintBacklogWorkType.DEFAULT
                    : item.getWorkType();
            if (type != SprintBacklogWorkType.STORY && type != SprintBacklogWorkType.TASK) {
                continue;
            }
            TimeSample sample = backlogLeadSample(item, backlogHistory.getOrDefault(item.getId(), List.of()), asOf);
            if (sample == null) {
                continue;
            }
            LocalDate completedOn = toTenantDate(sample.completedAt(), serverZone, tenantZone);
            if (completedOn.isBefore(windowStart) || completedOn.isAfter(windowEnd)) {
                continue;
            }
            LeadAccumulator accumulator = grouped.computeIfAbsent(completedOn, key -> new LeadAccumulator());
            if (type == SprintBacklogWorkType.STORY) {
                accumulator.addStory(sample.days());
            } else {
                accumulator.addTask(sample.days());
            }
        }

        for (Task subtask : doneSubtasks) {
            if (subtask.getId() == null) {
                continue;
            }
            TimeSample sample = subtaskLeadSample(
                    subtask, subtaskHistory.getOrDefault(subtask.getId(), List.of()), asOf);
            if (sample == null) {
                continue;
            }
            LocalDate completedOn = toTenantDate(sample.completedAt(), serverZone, tenantZone);
            if (completedOn.isBefore(windowStart) || completedOn.isAfter(windowEnd)) {
                continue;
            }
            grouped.computeIfAbsent(completedOn, key -> new LeadAccumulator()).addSubtask(sample.days());
        }

        List<ProjectAnalyticsResponse.LeadTimePoint> points = grouped.entrySet().stream()
                .map(entry -> entry.getValue().toPoint(entry.getKey()))
                .toList();
        return new ProjectAnalyticsResponse.LeadTimeTrend(
                points.isEmpty() ? STATE_EMPTY : STATE_READY,
                tenantZone.getId(),
                LEAD_TIME_SERIES,
                points);
    }

    /**
     * US-ANL-007: work item completion trend stacked bar chart, counting
     * completed items by completion date and work item type (Subtask, Story, Task).
     *
     * <p>Only items currently in status {@code DONE} that reached {@code DONE}
     * on or before {@code asOf} are counted (AC03: reopened items are excluded).
     * With no date restriction, the total across all bars matches the {@code Done}
     * total of {@link #creationTrend} (AC02).</p>
     */
    private ProjectAnalyticsResponse.CompletionTrend completionTrend(
            List<SprintBacklog> doneBacklogItems,
            List<Task> doneSubtasks,
            Map<Long, List<SprintBacklogAuditLog>> backlogHistory,
            Map<UUID, List<TaskAuditLog>> subtaskHistory,
            LocalDate windowStart,
            LocalDate windowEnd,
            ZoneId tenantZone,
            ZoneId serverZone,
            LocalDateTime asOf) {
        Map<LocalDate, CompletionAccumulator> grouped = new TreeMap<>();
        boolean hasTasks = false;

        for (SprintBacklog item : doneBacklogItems) {
            LocalDate completedOn = backlogCompletedOn(
                    item, backlogHistory.getOrDefault(item.getId(), List.of()), asOf, serverZone, tenantZone);
            if (completedOn == null || completedOn.isBefore(windowStart) || completedOn.isAfter(windowEnd)) {
                continue;
            }
            CompletionAccumulator accumulator = grouped.computeIfAbsent(completedOn, key -> new CompletionAccumulator());
            if (item.getWorkType() == SprintBacklogWorkType.STORY) {
                accumulator.story++;
            } else {
                accumulator.task++;
                hasTasks = true;
            }
        }

        for (Task subtask : doneSubtasks) {
            LocalDate completedOn = subtaskCompletedOn(
                    subtask, subtaskHistory.getOrDefault(subtask.getId(), List.of()), asOf, serverZone, tenantZone);
            if (completedOn == null || completedOn.isBefore(windowStart) || completedOn.isAfter(windowEnd)) {
                continue;
            }
            grouped.computeIfAbsent(completedOn, key -> new CompletionAccumulator()).subtask++;
        }

        List<ProjectAnalyticsResponse.CompletionBucket> buckets = grouped.entrySet().stream()
                .map(entry -> entry.getValue().toBucket(entry.getKey()))
                .toList();
        List<ProjectAnalyticsResponse.Series> series = hasTasks
                ? List.of(
                        new ProjectAnalyticsResponse.Series("subtask", "Subtask"),
                        new ProjectAnalyticsResponse.Series("story", "Story"),
                        new ProjectAnalyticsResponse.Series("task", "Task"))
                : List.of(
                        new ProjectAnalyticsResponse.Series("subtask", "Subtask"),
                        new ProjectAnalyticsResponse.Series("story", "Story"));
        return new ProjectAnalyticsResponse.CompletionTrend(
                buckets.isEmpty() ? STATE_EMPTY : STATE_READY,
                tenantZone.getId(),
                series,
                buckets);
    }

    /**
     * Completion date of a Done backlog item in the tenant time zone, or
     * {@code null} when the item is not Done as of {@code asOf} (AC03).
     */
    private LocalDate backlogCompletedOn(
            SprintBacklog item,
            List<SprintBacklogAuditLog> events,
            LocalDateTime asOf,
            ZoneId serverZone,
            ZoneId tenantZone) {
        if (statusOf(item) != SprintBacklogStatus.DONE) {
            return null;
        }
        String done = SprintBacklogStatus.DONE.name();
        LocalDateTime finalDone = null;
        String lastStatus = null;
        for (SprintBacklogAuditLog event : events) {
            LocalDateTime at = event.getCreatedAt();
            String before = statusIn(event.getBeforeState());
            String after = statusIn(event.getAfterState());
            if (at == null || after == null || after.equals(before)) {
                continue;
            }
            if (done.equals(after)) {
                finalDone = at;
            }
            lastStatus = after;
        }
        if (lastStatus != null && !done.equals(lastStatus)) {
            return null;
        }
        LocalDateTime completedAt = finalDone != null
                ? finalDone
                : (item.getUpdatedAt() != null ? item.getUpdatedAt() : item.getCreatedAt());
        if (completedAt == null || completedAt.isAfter(asOf)) {
            return null;
        }
        return toTenantDate(completedAt, serverZone, tenantZone);
    }

    /**
     * Completion date of a Done subtask in the tenant time zone, or
     * {@code null} when the subtask is not Done as of {@code asOf} (AC03).
     */
    private LocalDate subtaskCompletedOn(
            Task subtask,
            List<TaskAuditLog> events,
            LocalDateTime asOf,
            ZoneId serverZone,
            ZoneId tenantZone) {
        if (subtask.getStatus() != TaskStatus.DONE) {
            return null;
        }
        String done = TaskStatus.DONE.name();
        LocalDateTime finalDone = null;
        String lastStatus = null;
        for (TaskAuditLog event : events) {
            LocalDateTime at = event.getOccurredAt();
            String before = statusIn(event.getBeforeState());
            String after = statusIn(event.getAfterState());
            if (at == null || after == null || after.equals(before)) {
                continue;
            }
            if (done.equals(after)) {
                finalDone = at;
            }
            lastStatus = after;
        }
        if (lastStatus != null && !done.equals(lastStatus)) {
            return null;
        }
        LocalDateTime completedAt = finalDone != null
                ? finalDone
                : (subtask.getUpdatedAt() != null ? subtask.getUpdatedAt() : subtask.getCreatedAt());
        if (completedAt == null || completedAt.isAfter(asOf)) {
            return null;
        }
        return toTenantDate(completedAt, serverZone, tenantZone);
    }

    /**
     * Lead time sample of one Done backlog item (Story or Task):
     * {@code (t_DONE - created_at) / 86400}, guaranteeing Lead Time >= Cycle Time (AC03).
     */
    private TimeSample backlogLeadSample(SprintBacklog item, List<SprintBacklogAuditLog> events, LocalDateTime asOf) {
        String done = SprintBacklogStatus.DONE.name();
        LocalDateTime finalDone = null;
        String lastStatus = null;

        for (SprintBacklogAuditLog event : events) {
            LocalDateTime at = event.getCreatedAt();
            String before = statusIn(event.getBeforeState());
            String after = statusIn(event.getAfterState());
            if (at == null || after == null || after.equals(before)) {
                continue;
            }
            if (done.equals(after)) {
                finalDone = at;
            }
            lastStatus = after;
        }

        if (lastStatus != null && !done.equals(lastStatus)) {
            return null;
        }
        LocalDateTime completedAt = finalDone != null ? finalDone : item.getUpdatedAt();
        if (completedAt == null || completedAt.isAfter(asOf)) {
            return null;
        }
        LocalDateTime createdAt = item.getCreatedAt();
        if (createdAt == null) {
            return null;
        }
        long seconds = Math.max(0L, Duration.between(createdAt, completedAt).getSeconds());
        return new TimeSample(completedAt, seconds / SECONDS_PER_DAY);
    }

    /**
     * Lead time sample of one Done subtask ({@code ProjectTask}):
     * {@code (t_DONE - Task.created_at) / 86400}.
     */
    private TimeSample subtaskLeadSample(Task subtask, List<TaskAuditLog> events, LocalDateTime asOf) {
        String done = TaskStatus.DONE.name();
        LocalDateTime finalDone = null;
        String lastStatus = null;

        for (TaskAuditLog event : events) {
            LocalDateTime at = event.getOccurredAt();
            String before = statusIn(event.getBeforeState());
            String after = statusIn(event.getAfterState());
            if (at == null || after == null || after.equals(before)) {
                continue;
            }
            if (done.equals(after)) {
                finalDone = at;
            }
            lastStatus = after;
        }

        if (lastStatus != null && !done.equals(lastStatus)) {
            return null;
        }
        LocalDateTime completedAt = finalDone != null ? finalDone : subtask.getUpdatedAt();
        if (completedAt == null || completedAt.isAfter(asOf)) {
            return null;
        }
        LocalDateTime createdAt = subtask.getCreatedAt();
        if (createdAt == null) {
            return null;
        }
        long seconds = Math.max(0L, Duration.between(createdAt, completedAt).getSeconds());
        return new TimeSample(completedAt, seconds / SECONDS_PER_DAY);
    }

    /**
     * Cycle time sample of one Done subtask ({@code ProjectTask}), used in the
     * US-ANL-008 drill-down drawer so subtasks also display individual cycle time.
     */
    private TimeSample subtaskCycleSample(Task subtask, List<TaskAuditLog> events, LocalDateTime asOf) {
        String todo = TaskStatus.TODO.name();
        String inProgress = TaskStatus.IN_PROGRESS.name();
        String done = TaskStatus.DONE.name();

        LocalDateTime firstInProgress = null;
        LocalDateTime firstLeftTodo = null;
        LocalDateTime finalDone = null;
        String lastStatus = null;

        for (TaskAuditLog event : events) {
            LocalDateTime at = event.getOccurredAt();
            String before = statusIn(event.getBeforeState());
            String after = statusIn(event.getAfterState());
            if (at == null || after == null || after.equals(before)) {
                continue;
            }
            if (inProgress.equals(after) && firstInProgress == null) {
                firstInProgress = at;
            }
            if (todo.equals(before) && !done.equals(after) && firstLeftTodo == null) {
                firstLeftTodo = at;
            }
            if (done.equals(after)) {
                finalDone = at;
            }
            lastStatus = after;
        }

        if (lastStatus != null && !done.equals(lastStatus)) {
            return null;
        }
        LocalDateTime completedAt = finalDone != null ? finalDone : subtask.getUpdatedAt();
        if (completedAt == null || completedAt.isAfter(asOf)) {
            return null;
        }
        LocalDateTime startedAt = firstInProgress != null
                ? firstInProgress
                : (firstLeftTodo != null ? firstLeftTodo : subtask.getCreatedAt());
        if (startedAt == null) {
            return null;
        }
        if (subtask.getCreatedAt() != null && startedAt.isBefore(subtask.getCreatedAt())) {
            startedAt = subtask.getCreatedAt();
        }
        long seconds = Math.max(0L, Duration.between(startedAt, completedAt).getSeconds());
        return new TimeSample(completedAt, seconds / SECONDS_PER_DAY);
    }

    /**
     * US-ANL-009 AC04: resolves the effective tenant time zone strictly from
     * {@code Tenant.timezone} first, falling back to the configured analytics
     * tenant zone (default {@code Asia/Ho_Chi_Minh}).
     */
    private ZoneId tenantZone(User user, Project project) {
        if (user != null && user.getTenant() != null) {
            ZoneId fromUserTenant = parseZoneOrNull(user.getTenant().getTimezone());
            if (fromUserTenant != null) {
                return fromUserTenant;
            }
        }
        Long tenantId = project != null && project.getTenantId() != null
                ? project.getTenantId()
                : (user == null ? null : user.getTenantId());
        if (tenantId != null) {
            ZoneId fromPersistedTenant = tenants.findById(tenantId)
                    .map(Tenant::getTimezone)
                    .map(ProjectAnalyticsService::parseZoneOrNull)
                    .orElse(null);
            if (fromPersistedTenant != null) {
                return fromPersistedTenant;
            }
        }
        ZoneId configured = parseZoneOrNull(tenantTimeZone);
        return configured != null ? configured : ZoneId.of("Asia/Ho_Chi_Minh");
    }

    private ZoneId storageZone() {
        ZoneId configured = parseZoneOrNull(storageTimeZone);
        return configured != null ? configured : ZoneId.systemDefault();
    }

    private static ZoneId parseZoneOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return ZoneId.of(raw.trim());
        } catch (DateTimeException invalid) {
            return null;
        }
    }

    private record TimeSample(LocalDateTime completedAt, double days) { }

    private static final class LeadAccumulator {
        private double storySum;
        private int storyCount;
        private double subtaskSum;
        private int subtaskCount;
        private double taskSum;
        private int taskCount;

        void addStory(double days) {
            storySum += days;
            storyCount++;
        }

        void addSubtask(double days) {
            subtaskSum += days;
            subtaskCount++;
        }

        void addTask(double days) {
            taskSum += days;
            taskCount++;
        }

        ProjectAnalyticsResponse.LeadTimePoint toPoint(LocalDate date) {
            return new ProjectAnalyticsResponse.LeadTimePoint(
                    date,
                    storyCount == 0 ? null : roundOneDecimal(storySum / storyCount),
                    storyCount,
                    subtaskCount == 0 ? null : roundOneDecimal(subtaskSum / subtaskCount),
                    subtaskCount,
                    taskCount == 0 ? null : roundOneDecimal(taskSum / taskCount),
                    taskCount);
        }
    }

    private static final class CompletionAccumulator {
        private long subtask;
        private long story;
        private long task;

        ProjectAnalyticsResponse.CompletionBucket toBucket(LocalDate date) {
            return new ProjectAnalyticsResponse.CompletionBucket(date, subtask, story, task);
        }
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
