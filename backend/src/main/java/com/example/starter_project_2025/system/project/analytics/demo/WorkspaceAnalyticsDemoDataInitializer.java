package com.example.starter_project_2025.system.project.analytics.demo;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogPriority;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogWorkType;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditRepository;
import jakarta.persistence.EntityManager;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Seeds a rolling sprint timeline (sprints, sprint backlog items and product
 * backlog items) into one workspace project so the project analytics feature
 * (US-ANL) has data to chart.
 *
 * <p>The workspace created from the "Demo E-Commerce Hub" template starts with
 * two product backlog items only, so every chart (creation trend, cycle time,
 * lead time, completion trend) stays empty until somebody moves items on the
 * board. This seed adds:</p>
 * <ul>
 *     <li>three {@code COMPLETED} sprints covering the last three weeks,</li>
 *     <li>the current sprint (reusing the project's existing {@code ACTIVE}
 *     sprint, or creating one when the project has none),</li>
 *     <li>work items in every status ({@code TODO}, {@code IN_PROGRESS},
 *     {@code REVIEW}, {@code DONE}) with varied work types, priorities,
 *     estimates and completion dates,</li>
 *     <li>the matching {@code sprint_backlog_audit_log} transitions, so cycle
 *     time ("first move to In progress → Done") and lead time ("created →
 *     Done") are measurable instead of falling back to {@code created_at} /
 *     {@code updated_at}.</li>
 * </ul>
 *
 * <p>Every date is computed from {@link LocalDate#now()} at startup: the oldest
 * item is created {@value #WINDOW_DAYS} days ago and the newest one is
 * completed today. The seed is idempotent — sprints are matched by project +
 * name and items by project + title, so a restart never duplicates a row and
 * never rewrites dates that an earlier run already stored.</p>
 *
 * <p>{@code created_at} / {@code updated_at} are back-dated with native SQL
 * because both columns are populated by {@code @CreationTimestamp} /
 * {@code @UpdateTimestamp} on insert; analytics reads the stored timestamps, so
 * a plain JPA insert would make every item look created today.</p>
 */
@Slf4j
@Component
@Order(45)
@Profile("!test & !prod")
@ConditionalOnProperty(name = "app.seed.analytics-demo.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class WorkspaceAnalyticsDemoDataInitializer implements CommandLineRunner {

    /** Length of the seeded history: the oldest work item is created 21 days ago. */
    static final int WINDOW_DAYS = 21;

    /** Correlation id stored on every seeded audit row. */
    static final String CORRELATION_ID = "analytics-demo-seed-v1";

    /** Actor recorded on the seeded status transitions. */
    static final String SEED_ACTOR = "analytics.demo@example.com";

    ProjectRepository projects;
    ProjectTeamRepository teams;
    SprintRepository sprints;
    SprintBacklogRepository backlogs;
    SprintBacklogAuditRepository audits;
    EntityManager entityManager;

    /** Project code the seed targets; {@code C9-A2-M9} is the demo E-Commerce workspace. */
    @Value("${app.seed.analytics-demo.project-code:C9-A2-M9}")
    @NonFinal
    String projectCode;

    /** Optional explicit project id; takes precedence over {@link #projectCode} when positive. */
    @Value("${app.seed.analytics-demo.project-id:0}")
    @NonFinal
    long projectId;

    @Override
    @Transactional
    public void run(String... args) {
        Project project = resolveProject();
        if (project == null) {
            log.info("Analytics demo seed skipped: project '{}' does not exist.", projectCode);
            return;
        }

        Long teamId = teamIdOf(project.getId());
        LocalDate today = LocalDate.now();
        // Nothing may land in the future: analytics ignores transitions after
        // the end of its window.
        LocalDateTime limit = today.atTime(23, 59);

        int sprintCount = 0;
        int itemCount = 0;

        for (SprintPlan plan : List.of(discoverySprint(today), coreBuildSprint(today), hardeningSprint(today))) {
            SeededSprint seeded = upsertSprint(project, teamId, plan);
            sprintCount += seeded.created() ? 1 : 0;
            for (ItemPlan item : plan.items()) {
                itemCount += seedSprintItem(seeded.sprint(), project.getId(), plan.start(), item, limit) ? 1 : 0;
            }
        }

        CurrentSprint current = currentSprint(project, teamId, today);
        sprintCount += current.created() ? 1 : 0;
        for (ItemPlan item : inFlightSprint(today).items()) {
            itemCount += seedSprintItem(current.sprint(), project.getId(), current.start(), item, limit) ? 1 : 0;
        }

        for (ProductItemPlan item : productBacklog(today)) {
            itemCount += seedProductBacklogItem(project.getId(), item) ? 1 : 0;
        }

        log.info("Analytics demo seed ensured {} sprint(s) and {} new work item(s) for project {} ({} to {}).",
                sprintCount, itemCount, project.getCode(), today.minusDays(WINDOW_DAYS), today);
    }

    // ------------------------------------------------------------------
    // Project / team lookup
    // ------------------------------------------------------------------

    private Project resolveProject() {
        if (projectId > 0) {
            return projects.findById(projectId).orElse(null);
        }
        return projectCode == null || projectCode.isBlank()
                ? null
                : projects.findByCode(projectCode).orElse(null);
    }

    /** Team that owns the workspace board; sprints are linked to it when it exists. */
    private Long teamIdOf(Long projectId) {
        List<ProjectTeam> projectTeams = teams.findAllByProject_IdInOrderByIdDesc(List.of(projectId));
        return projectTeams.stream().map(ProjectTeam::getId).filter(Objects::nonNull).findFirst().orElse(null);
    }

    // ------------------------------------------------------------------
    // Sprint seeding
    // ------------------------------------------------------------------

    private SeededSprint upsertSprint(Project project, Long teamId, SprintPlan plan) {
        Sprint existing = sprints.findFirstByProjectIdAndNameOrderByIdAsc(project.getId(), plan.name()).orElse(null);
        if (existing != null) {
            return new SeededSprint(existing, false);
        }

        Sprint sprint = new Sprint();
        sprint.setName(plan.name());
        sprint.setSprintGoal(plan.goal());
        sprint.setProjectId(project.getId());
        sprint.setTeamId(teamId);
        sprint.setStartDate(plan.start().atStartOfDay());
        sprint.setEndDate(plan.end().atStartOfDay());
        sprint.setStatus(plan.status());
        sprint.setIsActive(true);
        Sprint saved = sprints.saveAndFlush(sprint);

        backdateSprint(saved.getId(), plan.start().atStartOfDay(), plan.start().atStartOfDay());
        log.info("Seeded analytics demo sprint '{}' ({} → {}, {}).",
                plan.name(), plan.start(), plan.end(), plan.status());
        return new SeededSprint(saved, true);
    }

    /**
     * The sprint that owns the "still open" items: the project's ACTIVE sprint
     * when one exists (a project may only have one), otherwise a fresh sprint
     * that starts three days ago.
     */
    private CurrentSprint currentSprint(Project project, Long teamId, LocalDate today) {
        Sprint active = sprints.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(project.getId())
                .stream()
                .filter(sprint -> sprint.getStatus() == SprintStatus.ACTIVE)
                .findFirst()
                .orElse(null);
        if (active != null) {
            LocalDate todayMinusThree = today.minusDays(3);
            LocalDate start = active.getStartDate() == null
                    ? todayMinusThree
                    : active.getStartDate().toLocalDate();
            // A sprint that starts today (or later) leaves no room for a
            // realistic history, so the offsets are anchored three days back.
            return new CurrentSprint(active, start.isAfter(todayMinusThree) ? todayMinusThree : start, false);
        }

        SprintPlan plan = inFlightSprint(today);
        SeededSprint seeded = upsertSprint(project, teamId, plan);
        return new CurrentSprint(seeded.sprint(), plan.start(), seeded.created());
    }

    // ------------------------------------------------------------------
    // Work item seeding
    // ------------------------------------------------------------------

    private boolean seedSprintItem(Sprint sprint, Long projectId, LocalDate sprintStart, ItemPlan plan,
                                   LocalDateTime limit) {
        boolean alreadySeeded = backlogs
                .findAllByProjectIdAndTitleIgnoreCaseAndIsActiveTrue(projectId, plan.title())
                .stream()
                .anyMatch(item -> item.getSprint() != null
                        && Objects.equals(item.getSprint().getId(), sprint.getId()));
        if (alreadySeeded) {
            return false;
        }

        LocalDateTime created = clamp(at(sprintStart, plan.createdDay(), 9), limit);
        LocalDateTime inProgress = plan.inProgressDay() < 0
                ? null : clamp(at(sprintStart, plan.inProgressDay(), 10), limit);
        LocalDateTime review = plan.reviewDay() < 0
                ? null : clamp(at(sprintStart, plan.reviewDay(), 14), limit);
        LocalDateTime done = plan.doneDay() < 0
                ? null : clamp(at(sprintStart, plan.doneDay(), 17), limit);

        LocalDateTime updated = done != null ? done : review != null ? review : inProgress != null ? inProgress : created;
        LocalDateTime plannedEnd = done != null ? done : created.plusDays(2);

        SprintBacklog item = new SprintBacklog();
        item.setSprint(sprint);
        item.setProjectId(projectId);
        item.setTitle(plan.title());
        item.setDescription(plan.description());
        item.setStatus(plan.status());
        item.setPriority(plan.priority());
        item.setWorkType(plan.type());
        item.setEstimatedHours(plan.hours());
        item.setStartDate(created);
        item.setEndDate(plannedEnd.isAfter(created) ? plannedEnd : created.plusDays(1));
        item.setIsActive(true);
        SprintBacklog saved = backlogs.saveAndFlush(item);

        backdateBacklog(saved.getId(), created, updated);

        if (inProgress != null) {
            auditTransition(saved, sprint, SprintBacklogStatus.TODO, SprintBacklogStatus.IN_PROGRESS, inProgress);
        }
        if (review != null) {
            auditTransition(saved, sprint, SprintBacklogStatus.IN_PROGRESS, SprintBacklogStatus.REVIEW, review);
        }
        if (done != null) {
            auditTransition(saved, sprint, SprintBacklogStatus.REVIEW, SprintBacklogStatus.DONE, done);
        }
        return true;
    }

    private boolean seedProductBacklogItem(Long projectId, ProductItemPlan plan) {
        boolean alreadySeeded = backlogs
                .findFirstByProjectIdAndSprintIsNullAndTitleIgnoreCaseOrderByIdAsc(projectId, plan.title())
                .isPresent();
        if (alreadySeeded) {
            return false;
        }

        LocalDate createdDay = LocalDate.now().minusDays(plan.createdDaysAgo());
        LocalDateTime created = createdDay.atTime(10, 0);

        SprintBacklog item = new SprintBacklog();
        item.setProjectId(projectId);
        item.setTitle(plan.title());
        item.setDescription(plan.description());
        item.setStatus(SprintBacklogStatus.TODO);
        item.setPriority(plan.priority());
        item.setWorkType(plan.type());
        item.setEstimatedHours(plan.hours());
        item.setIsActive(true);
        SprintBacklog saved = backlogs.saveAndFlush(item);

        backdateBacklog(saved.getId(), created, created);
        return true;
    }

    // ------------------------------------------------------------------
    // Back-dating and audit trail
    // ------------------------------------------------------------------

    private void backdateSprint(Long sprintId, LocalDateTime createdAt, LocalDateTime updatedAt) {
        entityManager.createNativeQuery("""
                        update sprint
                           set created_at = :createdAt, updated_at = :updatedAt
                         where sprint_id = :id
                        """)
                .setParameter("createdAt", createdAt)
                .setParameter("updatedAt", updatedAt)
                .setParameter("id", sprintId)
                .executeUpdate();
    }

    private void backdateBacklog(Long backlogId, LocalDateTime createdAt, LocalDateTime updatedAt) {
        entityManager.flush();
        entityManager.createNativeQuery("""
                        update sprint_backlog
                           set created_at = :createdAt, updated_at = :updatedAt
                         where sprint_backlog_id = :id
                        """)
                .setParameter("createdAt", createdAt)
                .setParameter("updatedAt", updatedAt)
                .setParameter("id", backlogId)
                .executeUpdate();
    }

    /**
     * Writes one status transition to the append-only backlog audit trail and
     * back-dates it, because analytics derives cycle/lead time from the audit
     * timestamps (see {@code ProjectAnalyticsService}).
     */
    private void auditTransition(SprintBacklog item, Sprint sprint,
                                 SprintBacklogStatus before, SprintBacklogStatus after,
                                 LocalDateTime occurredAt) {
        SprintBacklogAuditLog entry = SprintBacklogAuditLog.builder()
                .sprintBacklogId(item.getId())
                .sprintId(sprint.getId())
                .action("UPDATE")
                .actorEmail(SEED_ACTOR)
                .correlationId(CORRELATION_ID)
                .beforeState("{\"status\":\"" + before.name() + "\"}")
                .afterState("{\"status\":\"" + after.name() + "\"}")
                .build();
        SprintBacklogAuditLog saved = audits.saveAndFlush(entry);

        entityManager.createNativeQuery("""
                        update sprint_backlog_audit_log
                           set created_at = :occurredAt
                         where id = :id
                        """)
                .setParameter("occurredAt", occurredAt)
                .setParameter("id", saved.getId())
                .executeUpdate();
    }

    private static LocalDateTime at(LocalDate sprintStart, int dayOffset, int hour) {
        return sprintStart.plusDays(dayOffset).atTime(hour, 0);
    }

    private static LocalDateTime clamp(LocalDateTime value, LocalDateTime limit) {
        return value.isAfter(limit) ? limit : value;
    }

    // ------------------------------------------------------------------
    // Seed plans — all offsets are relative to the sprint start, which is
    // derived from "today" at startup
    // ------------------------------------------------------------------

    /** Sprint 1: discovery, three weeks ago. */
    private SprintPlan discoverySprint(LocalDate today) {
        LocalDate start = today.minusDays(WINDOW_DAYS);
        return new SprintPlan(
                "ANA Sprint 1 - Discovery",
                "Map the current journey and freeze the module API contracts",
                start,
                start.plusDays(5),
                SprintStatus.COMPLETED,
                List.of(
                        done("Map the checkout user journey",
                                "Interview the storefront owner and document the as-is checkout flow with its pain points.",
                                SprintBacklogWorkType.STORY, SprintBacklogPriority.HIGH, 12.0, 0, 1, 2, 3),
                        done("Audit the Auth module API contract",
                                "Compare the frozen Auth contract with the implementation and list every difference.",
                                SprintBacklogWorkType.TASK, SprintBacklogPriority.MEDIUM, 8.0, 1, 2, 3, 4),
                        done("Fix the duplicated cart validation",
                                "The cart endpoint validates the same payload twice; keep a single validation path.",
                                SprintBacklogWorkType.BUG, SprintBacklogPriority.URGENT, 4.0, 0, 3, 3, 3),
                        done("Document the non-functional requirements",
                                "Record the performance, availability and security targets agreed with the mentor.",
                                SprintBacklogWorkType.TASK, SprintBacklogPriority.LOW, 6.0, 2, 3, 4, 4),
                        done("Set up the payment sandbox",
                                "Provision the sandbox account and document the test cards used by the team.",
                                SprintBacklogWorkType.TASK, SprintBacklogPriority.MEDIUM, 10.0, 1, 2, 3, 5),
                        done("Draft the integration test plan",
                                "List the end-to-end scenarios that must pass before the hardening sprint.",
                                SprintBacklogWorkType.STORY, SprintBacklogPriority.MEDIUM, 8.0, 3, 4, 4, 5)));
    }

    /** Sprint 2: core build, two weeks ago. */
    private SprintPlan coreBuildSprint(LocalDate today) {
        LocalDate start = today.minusDays(15);
        return new SprintPlan(
                "ANA Sprint 2 - Core build",
                "Deliver the catalog search and the order data model",
                start,
                start.plusDays(5),
                SprintStatus.COMPLETED,
                List.of(
                        done("Design the order data model",
                                "Model orders, lines and payments with their constraints and write the migration.",
                                SprintBacklogWorkType.STORY, SprintBacklogPriority.HIGH, 14.0, 0, 1, 2, 4),
                        done("Implement the catalog search API",
                                "Provide paging, sorting and keyword filtering over the catalog service.",
                                SprintBacklogWorkType.STORY, SprintBacklogPriority.URGENT, 20.0, 0, 0, 2, 3),
                        done("Fix the broken catalog pagination",
                                "The last page repeats the previous one when the size divides the total evenly.",
                                SprintBacklogWorkType.BUG, SprintBacklogPriority.HIGH, 5.0, 1, 2, 2, 2),
                        done("Add category filters to the storefront",
                                "Let shoppers filter the catalog by category and keep the selection in the URL.",
                                SprintBacklogWorkType.STORY, SprintBacklogPriority.MEDIUM, 16.0, 2, 3, 4, 5),
                        done("Write the payment webhook contract",
                                "Document the callback payload, the retry policy and the signature check.",
                                SprintBacklogWorkType.TASK, SprintBacklogPriority.MEDIUM, 8.0, 3, 4, 5, 5)));
    }

    /** Sprint 3: hardening, last week. */
    private SprintPlan hardeningSprint(LocalDate today) {
        LocalDate start = today.minusDays(9);
        return new SprintPlan(
                "ANA Sprint 3 - Hardening",
                "Integrate payments and harden the security and delivery paths",
                start,
                start.plusDays(5),
                SprintStatus.COMPLETED,
                List.of(
                        done("Integrate the payment gateway",
                                "Charge, capture and refund through the gateway sandbox with idempotent requests.",
                                SprintBacklogWorkType.STORY, SprintBacklogPriority.URGENT, 24.0, 0, 1, 3, 5),
                        done("Add retry handling to webhook delivery",
                                "Retry failed callbacks with exponential backoff and stop after five attempts.",
                                SprintBacklogWorkType.BUG, SprintBacklogPriority.HIGH, 6.0, 1, 2, 3, 4),
                        done("Harden the auth token refresh",
                                "Rotate refresh tokens, revoke the previous one and cover the flow with tests.",
                                SprintBacklogWorkType.TASK, SprintBacklogPriority.HIGH, 10.0, 0, 2, 3, 4),
                        done("Send the checkout confirmation email",
                                "Queue the confirmation mail after a successful payment and render the order summary.",
                                SprintBacklogWorkType.STORY, SprintBacklogPriority.MEDIUM, 12.0, 2, 3, 4, 5),
                        done("Review the database indexes",
                                "Check the slow queries of the catalog and add the missing composite indexes.",
                                SprintBacklogWorkType.TASK, SprintBacklogPriority.LOW, 4.0, 3, 4, 4, 5)));
    }

    /** Sprint 4: the sprint in flight, spanning the last few days up to today. */
    private SprintPlan inFlightSprint(LocalDate today) {
        LocalDate start = today.minusDays(3);
        return new SprintPlan(
                "ANA Sprint 4 - In flight",
                "Ship the review flow and close the checkout hardening items",
                start,
                start.plusDays(6),
                SprintStatus.ACTIVE,
                List.of(
                        inProgress("Add the product review API",
                                "Expose create/list endpoints for product reviews with a moderation flag.",
                                SprintBacklogWorkType.STORY, SprintBacklogPriority.HIGH, 16.0, 0, 1),
                        done("Fix the checkout totals rounding",
                                "Totals are rounded per line instead of per order, so the sum is off by one cent.",
                                SprintBacklogWorkType.BUG, SprintBacklogPriority.URGENT, 3.0, 0, 1, 2, 3),
                        done("Polish the storefront empty states",
                                "Give the search, catalog and cart pages a consistent empty and error state.",
                                SprintBacklogWorkType.TASK, SprintBacklogPriority.MEDIUM, 8.0, 1, 2, 2, 3),
                        review("Review the payment API documentation",
                                "Check the request/response examples against the running sandbox before publishing.",
                                SprintBacklogWorkType.TASK, SprintBacklogPriority.MEDIUM, 4.0, 1, 2, 3),
                        open("Write the module handover notes",
                                "Summarise the module scope, the open risks and the demo script for the mentor review.",
                                SprintBacklogWorkType.TASK, SprintBacklogPriority.LOW, 6.0, 2)));
    }

    /** Product backlog: no sprint, still waiting to be planned. */
    private List<ProductItemPlan> productBacklog(LocalDate today) {
        return List.of(
                product("Spike: evaluate a recommendation service",
                        "Compare two hosted recommendation services and report cost, latency and privacy impact.",
                        SprintBacklogWorkType.STORY, SprintBacklogPriority.MEDIUM, 8.0, 20),
                product("Investigate the slow catalog search query",
                        "Reproduce the 2s catalog search on the largest category and attach the query plan.",
                        SprintBacklogWorkType.BUG, SprintBacklogPriority.HIGH, 6.0, 13),
                product("Prepare the release readiness checklist",
                        "Collect the gates (tests, docs, data migration) that must be green before the release.",
                        SprintBacklogWorkType.TASK, SprintBacklogPriority.MEDIUM, 4.0, 7),
                product("Define the analytics events for checkout",
                        "Agree the event names, payloads and owners for the checkout funnel instrumentation.",
                        SprintBacklogWorkType.STORY, SprintBacklogPriority.LOW, 6.0, 2));
    }

    private static ItemPlan done(String title, String description, SprintBacklogWorkType type,
                                 SprintBacklogPriority priority, double hours,
                                 int createdDay, int inProgressDay, int reviewDay, int doneDay) {
        return new ItemPlan(title, description, type, priority, hours, SprintBacklogStatus.DONE,
                createdDay, inProgressDay, reviewDay, doneDay);
    }

    private static ItemPlan review(String title, String description, SprintBacklogWorkType type,
                                   SprintBacklogPriority priority, double hours,
                                   int createdDay, int inProgressDay, int reviewDay) {
        return new ItemPlan(title, description, type, priority, hours, SprintBacklogStatus.REVIEW,
                createdDay, inProgressDay, reviewDay, -1);
    }

    private static ItemPlan inProgress(String title, String description, SprintBacklogWorkType type,
                                       SprintBacklogPriority priority, double hours,
                                       int createdDay, int inProgressDay) {
        return new ItemPlan(title, description, type, priority, hours, SprintBacklogStatus.IN_PROGRESS,
                createdDay, inProgressDay, -1, -1);
    }

    private static ItemPlan open(String title, String description, SprintBacklogWorkType type,
                                 SprintBacklogPriority priority, double hours, int createdDay) {
        return new ItemPlan(title, description, type, priority, hours, SprintBacklogStatus.TODO,
                createdDay, -1, -1, -1);
    }

    private static ProductItemPlan product(String title, String description, SprintBacklogWorkType type,
                                           SprintBacklogPriority priority, double hours, int createdDaysAgo) {
        return new ProductItemPlan(title, description, type, priority, hours, createdDaysAgo);
    }

    private record SprintPlan(String name, String goal, LocalDate start, LocalDate end,
                              SprintStatus status, List<ItemPlan> items) { }

    private record SeededSprint(Sprint sprint, boolean created) { }

    private record CurrentSprint(Sprint sprint, LocalDate start, boolean created) { }

    /**
     * @param createdDay    days after the sprint start when the item was created
     * @param inProgressDay days after the sprint start of the first "In progress" move,
     *                      {@code -1} when it never happened
     * @param reviewDay     days after the sprint start of the "Review" move, {@code -1} when absent
     * @param doneDay       days after the sprint start of the "Done" move, {@code -1} when absent
     */
    private record ItemPlan(String title, String description, SprintBacklogWorkType type,
                            SprintBacklogPriority priority, double hours, SprintBacklogStatus status,
                            int createdDay, int inProgressDay, int reviewDay, int doneDay) { }

    private record ProductItemPlan(String title, String description, SprintBacklogWorkType type,
                                   SprintBacklogPriority priority, double hours, int createdDaysAgo) { }
}
