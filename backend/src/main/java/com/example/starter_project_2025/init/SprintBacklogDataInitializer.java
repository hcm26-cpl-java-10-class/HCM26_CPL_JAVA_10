package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogPriority;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Seeds sample {@link SprintBacklog} rows, following the same idempotent upsert
 * pattern used by {@link SprintDataInitializer}.
 * <p>
 * Runs after {@link SprintDataInitializer} (@Order(12)) so the sample items can
 * point at real sprint ids resolved by name instead of hard coded ones.
 * <p>
 * Every seeded row respects the business rules enforced by
 * {@code SprintBacklogServiceImpl}:
 * <ul>
 *     <li>the owning sprint exists when one is given (Sprint 1 / 2 / 3), while
 *     the product backlog items have no sprint at all</li>
 *     <li>title mandatory, 1..200 characters</li>
 *     <li>description at most 2000 characters</li>
 *     <li>start date strictly before end date (both provided)</li>
 *     <li>status one of {@link SprintBacklogStatus}</li>
 *     <li>assignee id is a positive placeholder (project member module is not
 *     implemented yet)</li>
 * </ul>
 */
@Slf4j
@Order(14)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintBacklogDataInitializer implements CommandLineRunner {

    static final long MEMBER_1 = 1L;
    static final long MEMBER_2 = 2L;
    static final long MEMBER_3 = 3L;

    SprintBacklogRepository sprintBacklogRepository;
    SprintRepository sprintRepository;

    @Override
    @Transactional
    public void run(String... args) {

        Sprint discovery = findSprint("Sprint 1 - Discovery");
        Sprint design = findSprint("Sprint 2 - Design System");
        Sprint build = findSprint("Sprint 3 - Build");

        // Sprint 1 - Discovery (active): one finished item, one still running.
        upsertBacklog(discovery, MEMBER_1,
                "Map current user journeys",
                "Interview 5 stakeholders and document the as-is flows of the current release",
                LocalDateTime.of(2026, 10, 19, 9, 0),
                LocalDateTime.of(2026, 10, 22, 17, 0),
                SprintBacklogStatus.DONE,
                SprintBacklogPriority.HIGH,
                12.0);

        upsertBacklog(discovery, MEMBER_2,
                "Gather stakeholder requirements",
                "Consolidate the requirement backlog with the product owner before the review",
                LocalDateTime.of(2026, 10, 20, 9, 0),
                LocalDateTime.of(2026, 10, 28, 17, 0),
                SprintBacklogStatus.IN_PROGRESS,
                SprintBacklogPriority.URGENT,
                16.0);

        // Sprint 2 - Design System (planned): tokens under review, library pending.
        upsertBacklog(design, MEMBER_2,
                "Define design tokens",
                "Colours, typography and spacing tokens shared by every product surface",
                LocalDateTime.of(2026, 11, 2, 9, 0),
                LocalDateTime.of(2026, 11, 6, 17, 0),
                SprintBacklogStatus.REVIEW,
                SprintBacklogPriority.MEDIUM,
                8.0);

        upsertBacklog(design, MEMBER_3,
                "Deliver shared component library",
                "Buttons, inputs, table and modal primitives with theming support",
                LocalDateTime.of(2026, 11, 4, 9, 0),
                LocalDateTime.of(2026, 11, 12, 17, 0),
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.HIGH,
                24.0);

        // Sprint 3 - Build (planned): implementation tasks not started yet.
        upsertBacklog(build, MEMBER_3,
                "Implement landing page",
                "Hero, feature grid and call to action sections built on the new design system",
                LocalDateTime.of(2026, 11, 16, 9, 0),
                LocalDateTime.of(2026, 11, 20, 17, 0),
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.MEDIUM,
                20.0);

        upsertBacklog(build, MEMBER_1,
                "Update brand guidelines",
                "Refresh the brand book with the final palette and typography decisions",
                LocalDateTime.of(2026, 11, 23, 9, 0),
                LocalDateTime.of(2026, 11, 27, 17, 0),
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.LOW,
                6.0);

        // Product backlog: items without a sprint, so the backlog page only
        // offers these (and not the work already planned in another sprint).
        upsertProductBacklog(MEMBER_2,
                "Clarify release acceptance criteria",
                "Collect the acceptance criteria of the next release from QA and the product owner",
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.HIGH,
                4.0);

        upsertProductBacklog(MEMBER_1,
                "Audit accessibility of the checkout flow",
                "Check the checkout screens against WCAG AA before planning the next sprint",
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.URGENT,
                8.0);

        log.info("Ensured sample sprint backlog data.");
    }

    private void upsertBacklog(
            Sprint sprint,
            Long assigneeProjectMemberId,
            String title,
            String description,
            LocalDateTime startDate,
            LocalDateTime endDate,
            SprintBacklogStatus status,
            SprintBacklogPriority priority,
            Double estimatedHours
    ) {

        if (sprint == null) {
            // Sprint seeders did not run: nothing to attach the item to.
            return;
        }

        SprintBacklog backlog = sprintBacklogRepository
                .findBySprintIdAndTitleIgnoreCase(sprint.getId(), title)
                .orElseGet(SprintBacklog::new);

        backlog.setSprint(sprint);
        backlog.setAssigneeProjectMemberId(assigneeProjectMemberId);
        backlog.setTitle(title);
        backlog.setDescription(description);
        backlog.setStartDate(startDate);
        backlog.setEndDate(endDate);
        backlog.setStatus(status);
        backlog.setPriority(priority);
        backlog.setEstimatedHours(estimatedHours);
        backlog.setIsActive(true);

        sprintBacklogRepository.save(backlog);
    }

    private Sprint findSprint(String sprintName) {
        return sprintRepository.findByName(sprintName).orElse(null);
    }

    /**
     * Upserts a product backlog item: a backlog item that is not assigned to
     * any sprint yet.
     */
    private void upsertProductBacklog(
            Long assigneeProjectMemberId,
            String title,
            String description,
            SprintBacklogStatus status,
            SprintBacklogPriority priority,
            Double estimatedHours
    ) {

        SprintBacklog backlog = sprintBacklogRepository
                .findBySprintIsNullAndTitleIgnoreCase(title)
                .orElseGet(SprintBacklog::new);

        backlog.setSprint(null);
        backlog.setAssigneeProjectMemberId(assigneeProjectMemberId);
        backlog.setTitle(title);
        backlog.setDescription(description);
        backlog.setStartDate(null);
        backlog.setEndDate(null);
        backlog.setStatus(status);
        backlog.setPriority(priority);
        backlog.setEstimatedHours(estimatedHours);
        backlog.setIsActive(true);

        sprintBacklogRepository.save(backlog);
    }
}
