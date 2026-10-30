package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogPriority;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogWorkType;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Seeds sample {@link SprintBacklog} rows, following the same idempotent upsert
 * pattern used by {@link SprintDataInitializer}.
 * <p>
 * Runs after {@link SprintDataInitializer} (@Order(12)) and after the milestone
 * mock seed (@Order(12)) so the sample items can point at real sprint ids and
 * real milestone rows resolved by name instead of hard coded ones.
 * <p>
 * Every seeded row respects the business rules enforced by
 * {@code SprintBacklogServiceImpl}:
 * <ul>
 *     <li>the owning sprint exists when one is given (Sprint 1 / 2 / 3), while
 *     the product backlog items have no sprint at all</li>
 *     <li>the item belongs to the demo project ({@code project_id = 1})</li>
 *     <li>the linked milestone exists, is active and belongs to the same
 *     project (UFR-PRJ-003-02)</li>
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

    /** Project the seeded milestones belong to (see MockMilestoneData). */
    static final long DEMO_PROJECT_ID = 1L;
    static final long DEMO_TENANT_ID = 1L;

    static final String MILESTONE_REQUIREMENTS = "Requirements and Architecture Review";
    static final String MILESTONE_CORE_MVP = "Core Feature MVP";
    static final String MILESTONE_QUALITY_GATE = "Testing and Quality Gate";
    static final String MILESTONE_FINAL_DOCS = "Final Documentation";

    SprintBacklogRepository sprintBacklogRepository;
    SprintRepository sprintRepository;
    MilestoneRepository milestoneRepository;

    @Override
    @Transactional
    public void run(String... args) {

        Sprint discovery = findSprint("Sprint 1 - Discovery");
        Sprint design = findSprint("Sprint 2 - Design System");
        Sprint build = findSprint("Sprint 3 - Build");

        // Sprint 1 - Discovery (active): one finished item, one still running.
        upsertBacklog(discovery, MEMBER_1,
                "Map current user journeys",
                "Interview 5 stakeholders and document the as-is flows of the current release. "
                        + "Output: journey map + list of pain points validated with the product owner.",
                LocalDateTime.of(2026, 10, 19, 9, 0),
                LocalDateTime.of(2026, 10, 22, 17, 0),
                SprintBacklogStatus.DONE,
                SprintBacklogPriority.HIGH,
                SprintBacklogWorkType.STORY,
                12.0,
                MILESTONE_REQUIREMENTS);

        upsertBacklog(discovery, MEMBER_2,
                "Gather stakeholder requirements",
                "Consolidate the requirement backlog with the project owner before the review.\n"
                        + "Acceptance criteria:\n"
                        + "- every story has a clear acceptance criterion\n"
                        + "- non-functional requirements are listed\n"
                        + "- open questions are tracked",
                LocalDateTime.of(2026, 10, 20, 9, 0),
                LocalDateTime.of(2026, 10, 28, 17, 0),
                SprintBacklogStatus.IN_PROGRESS,
                SprintBacklogPriority.URGENT,
                SprintBacklogWorkType.STORY,
                16.0,
                MILESTONE_REQUIREMENTS);

        // Sprint 2 - Design System (planned): tokens under review, library pending.
        upsertBacklog(design, MEMBER_2,
                "Define design tokens",
                "Colours, typography and spacing tokens shared by every product surface. "
                        + "The token file is exported in JSON so the component library can consume it.",
                LocalDateTime.of(2026, 11, 2, 9, 0),
                LocalDateTime.of(2026, 11, 6, 17, 0),
                SprintBacklogStatus.REVIEW,
                SprintBacklogPriority.MEDIUM,
                SprintBacklogWorkType.TASK,
                8.0,
                MILESTONE_CORE_MVP);

        upsertBacklog(design, MEMBER_3,
                "Deliver shared component library",
                "Buttons, inputs, table and modal primitives with theming support. "
                        + "Each component ships with a Storybook example and an accessibility note.",
                LocalDateTime.of(2026, 11, 4, 9, 0),
                LocalDateTime.of(2026, 11, 12, 17, 0),
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.HIGH,
                SprintBacklogWorkType.TASK,
                24.0,
                MILESTONE_CORE_MVP);

        // Sprint 3 - Build (planned): implementation tasks not started yet.
        upsertBacklog(build, MEMBER_3,
                "Implement landing page",
                "Hero, feature grid and call to action sections built on the new design system. "
                        + "Must stay within the Lighthouse performance budget of 90.",
                LocalDateTime.of(2026, 11, 16, 9, 0),
                LocalDateTime.of(2026, 11, 20, 17, 0),
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.MEDIUM,
                SprintBacklogWorkType.STORY,
                20.0,
                MILESTONE_CORE_MVP);

        upsertBacklog(build, MEMBER_1,
                "Update brand guidelines",
                "Refresh the brand book with the final palette and typography decisions "
                        + "so the documentation milestone can reference the released version.",
                LocalDateTime.of(2026, 11, 23, 9, 0),
                LocalDateTime.of(2026, 11, 27, 17, 0),
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.LOW,
                SprintBacklogWorkType.TASK,
                6.0,
                MILESTONE_FINAL_DOCS);

        // Product backlog: items without a sprint, so the backlog page only
        // offers these (and not the work already planned in another sprint).
        upsertProductBacklog(MEMBER_2,
                "Clarify release acceptance criteria",
                "Collect the acceptance criteria of the next release from QA and the project owner "
                        + "and attach them to the quality gate milestone.",
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.HIGH,
                SprintBacklogWorkType.TASK,
                4.0,
                MILESTONE_QUALITY_GATE);

        upsertProductBacklog(MEMBER_1,
                "Audit accessibility of the checkout flow",
                "Check the checkout screens against WCAG AA before planning the next sprint. "
                        + "Report findings with screenshots and severity per screen.",
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.URGENT,
                SprintBacklogWorkType.BUG,
                8.0,
                MILESTONE_QUALITY_GATE);

        // Extra demo rows for the milestone linking walkthrough (UFR-PRJ-003-02).
        upsertProductBacklog(MEMBER_3,
                "Write the API documentation",
                "Document every REST endpoint of the project (request, response, error codes) "
                        + "and publish it next to the final documentation milestone.",
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.MEDIUM,
                SprintBacklogWorkType.STORY,
                10.0,
                MILESTONE_FINAL_DOCS);

        upsertProductBacklog(MEMBER_2,
                "Prepare the regression test plan",
                "List the end-to-end scenarios that must pass before the quality gate, "
                        + "with the owner and the expected evidence for each scenario.",
                SprintBacklogStatus.TODO,
                SprintBacklogPriority.HIGH,
                SprintBacklogWorkType.TASK,
                6.0,
                MILESTONE_QUALITY_GATE);

        log.info("Ensured sample sprint backlog data (with milestone links).");
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
            SprintBacklogWorkType workType,
            Double estimatedHours,
            String milestoneTitle
    ) {

        if (sprint == null) {
            // Sprint seeders did not run: nothing to attach the item to.
            return;
        }

        SprintBacklog backlog = sprintBacklogRepository
                .findBySprintIdAndTitleIgnoreCase(sprint.getId(), title)
                .orElseGet(SprintBacklog::new);

        backlog.setSprint(sprint);
        backlog.setProjectId(DEMO_PROJECT_ID);
        backlog.setMilestone(findMilestone(milestoneTitle));
        backlog.setAssigneeProjectMemberId(assigneeProjectMemberId);
        backlog.setTitle(title);
        backlog.setDescription(description);
        backlog.setStartDate(startDate);
        backlog.setEndDate(endDate);
        backlog.setStatus(status);
        backlog.setPriority(priority);
        backlog.setWorkType(workType);
        backlog.setEstimatedHours(estimatedHours);
        backlog.setIsActive(true);

        sprintBacklogRepository.save(backlog);
    }

    private Sprint findSprint(String sprintName) {
        return sprintRepository.findFirstByProjectIdAndNameOrderByIdAsc(DEMO_PROJECT_ID, sprintName).orElse(null);
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
            SprintBacklogWorkType workType,
            Double estimatedHours,
            String milestoneTitle
    ) {

        SprintBacklog backlog = sprintBacklogRepository
                .findBySprintIsNullAndTitleIgnoreCase(title)
                .orElseGet(SprintBacklog::new);

        backlog.setSprint(null);
        backlog.setProjectId(DEMO_PROJECT_ID);
        backlog.setMilestone(findMilestone(milestoneTitle));
        backlog.setAssigneeProjectMemberId(assigneeProjectMemberId);
        backlog.setTitle(title);
        backlog.setDescription(description);
        backlog.setStartDate(null);
        backlog.setEndDate(null);
        backlog.setStatus(status);
        backlog.setPriority(priority);
        backlog.setWorkType(workType);
        backlog.setEstimatedHours(estimatedHours);
        backlog.setIsActive(true);

        sprintBacklogRepository.save(backlog);
    }

    /**
     * Resolves a seeded milestone of the demo project by title. When the
     * milestone seed is disabled the item is simply created without a
     * milestone, so this initializer never blocks the startup.
     */
    private Milestone findMilestone(String title) {

        if (title == null) {
            return null;
        }

        List<Milestone> milestones = milestoneRepository
                .findByProjectIdAndTenantIdAndActiveTrueOrderByDeadlineAscIdAsc(
                        DEMO_PROJECT_ID, DEMO_TENANT_ID);

        return milestones.stream()
                .filter(milestone -> title.equals(milestone.getTitle()))
                .findFirst()
                .orElse(null);
    }
}

