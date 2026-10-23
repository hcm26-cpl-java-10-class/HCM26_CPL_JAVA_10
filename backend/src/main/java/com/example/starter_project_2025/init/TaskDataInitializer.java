package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.backlog_temp.Milestone;
import com.example.starter_project_2025.system.project.backlog_temp.MilestoneRepository;
import com.example.starter_project_2025.system.project.backlog_temp.Task;
import com.example.starter_project_2025.system.project.backlog_temp.TaskPriority;
import com.example.starter_project_2025.system.project.backlog_temp.TaskRepository;
import com.example.starter_project_2025.system.project.backlog_temp.TaskStatus;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds sample {@link Task} rows, following the same idempotent upsert pattern
 * used by {@link RoleDataInitializer} and {@link SprintDataInitializer}.
 * <p>
 * Runs after {@link SprintDataInitializer} (@Order(12)) so the sample tasks can
 * point at real sprint ids instead of hard coded ones.
 * <p>
 * The project / assignee identifiers are placeholders: those modules are not
 * implemented yet (the task module is a temporary stand-in), so the values only
 * need to be stable and consistent across the mock rows. Milestones are
 * resolved from the temporary milestone catalog ({@code MilestoneDataInitializer})
 * so every seeded backlog item is linked to a milestone of its own project.
 */
@Slf4j
@Order(13)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TaskDataInitializer implements CommandLineRunner {

    static final long PROJECT_1 = 1L;
    static final long PROJECT_2 = 2L;
    static final long PROJECT_3 = 3L;

    static final long MEMBER_1 = 1L;
    static final long MEMBER_2 = 2L;
    static final long MEMBER_3 = 3L;

    TaskRepository taskRepository;
    SprintRepository sprintRepository;
    MilestoneRepository milestoneRepository;

    @Override
    @Transactional
    public void run(String... args) {

        Long discoverySprint = sprintId("Sprint 1 - Discovery");
        Long designSprint = sprintId("Sprint 2 - Design System");
        Long buildSprint = sprintId("Sprint 3 - Build");

        // Only three sprints are seeded, so the items of the other sample
        // projects stay unassigned and show up in the product backlog.

        // Project 1 - Discovery / Design / Build
        upsertTask(PROJECT_1, discoverySprint, milestoneId(PROJECT_1, "M1 - Discovery"), MEMBER_1,
                "Map current user journeys",
                "Interview 5 stakeholders and document the as-is flows",
                8.0, TaskPriority.MEDIUM, TaskStatus.DONE);

        upsertTask(PROJECT_1, discoverySprint, null, MEMBER_2,
                "Gather stakeholder requirements",
                "Consolidate the requirement backlog with the product owner",
                12.0, TaskPriority.HIGH, TaskStatus.IN_PROGRESS);

        upsertTask(PROJECT_1, designSprint, milestoneId(PROJECT_1, "M2 - Design System"), MEMBER_2,
                "Deliver shared component library",
                "Buttons, inputs, table and modal primitives with theming support",
                24.0, TaskPriority.HIGH, TaskStatus.SPRINT_BACKLOG);

        upsertTask(PROJECT_1, designSprint, null, MEMBER_1,
                "Update brand guidelines",
                "Refresh colours, typography and spacing tokens",
                6.5, TaskPriority.LOW, TaskStatus.BACKLOG);

        upsertTask(PROJECT_1, buildSprint, milestoneId(PROJECT_1, "M2 - Design System"), MEMBER_3,
                "Implement landing page",
                "Hero, feature grid and call to action sections",
                16.0, TaskPriority.URGENT, TaskStatus.SPRINT_BACKLOG);

        upsertTask(PROJECT_1, buildSprint, null, MEMBER_3,
                "Accessibility audit",
                "Run axe checks and fix critical findings before release",
                5.0, TaskPriority.LOW, TaskStatus.SPRINT_BACKLOG);

        // Project 2 - Authentication / Payments (no sprint: product backlog)
        upsertTask(PROJECT_2, null, milestoneId(PROJECT_2, "M1 - Authentication"), MEMBER_1,
                "Implement biometric login",
                "Fingerprint and face unlock with device fallback",
                20.0, TaskPriority.HIGH, TaskStatus.BACKLOG);

        upsertTask(PROJECT_2, null, milestoneId(PROJECT_2, "M1 - Authentication"), MEMBER_2,
                "Add OTP fallback flow",
                "Six digit one time password with resend throttling",
                10.0, TaskPriority.MEDIUM, TaskStatus.BACKLOG);

        upsertTask(PROJECT_2, null, milestoneId(PROJECT_2, "M2 - Payments"), MEMBER_2,
                "Domestic transfer flow",
                "Beneficiary selection, limits and confirmation screens",
                18.5, TaskPriority.URGENT, TaskStatus.BACKLOG);

        upsertTask(PROJECT_2, null, null, MEMBER_3,
                "Bill payment integration",
                "Connect the billing provider sandbox and map error codes",
                14.0, TaskPriority.HIGH, TaskStatus.BACKLOG);

        // Project 3 - Employee Directory (no sprint: product backlog)
        upsertTask(PROJECT_3, null, milestoneId(PROJECT_3, "M1 - Employee Directory"), MEMBER_3,
                "Employee directory search",
                "Server side search with pagination and filters",
                12.0, TaskPriority.MEDIUM, TaskStatus.BACKLOG);

        upsertTask(PROJECT_3, null, null, MEMBER_1,
                "Org chart widget",
                "Collapsible organisation tree with lazy loading",
                9.0, TaskPriority.HIGH, TaskStatus.BACKLOG);

        log.info("Ensured sample task data for the temporary backlog module.");
    }

    private void upsertTask(
            Long projectId,
            Long sprintId,
            Long milestoneId,
            Long assigneeProjectMemberId,
            String title,
            String description,
            Double estimatedHours,
            TaskPriority priority,
            TaskStatus status
    ) {

        Task task = taskRepository.findByProjectIdAndTitleIgnoreCase(projectId, title)
                .orElseGet(Task::new);

        task.setProjectId(projectId);
        task.setSprintId(sprintId);
        task.setMilestoneId(milestoneId);
        task.setAssigneeProjectMemberId(assigneeProjectMemberId);
        task.setTitle(title);
        task.setDescription(description);
        task.setEstimatedHours(estimatedHours);
        task.setPriority(priority);
        task.setStatus(status);
        task.setIsActive(true);

        taskRepository.save(task);
    }

    private Long sprintId(String sprintName) {
        return sprintRepository.findByName(sprintName)
                .map(Sprint::getId)
                .orElse(null);
    }

    private Long milestoneId(Long projectId, String milestoneName) {
        return milestoneRepository.findByProjectIdAndNameIgnoreCase(projectId, milestoneName)
                .map(Milestone::getId)
                .orElse(null);
    }
}
