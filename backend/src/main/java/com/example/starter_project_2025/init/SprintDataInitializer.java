package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.Project;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Seeds sample {@link Project} and {@link Sprint} rows, following the same
 * idempotent upsert pattern used by {@link RoleDataInitializer}.
 * <p>
 * Runs after the RBAC/user seeders so the data is available as soon as the
 * application starts, and can safely run on every startup (existing rows are
 * updated instead of duplicated).
 */
@Slf4j
@Order(12)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintDataInitializer implements CommandLineRunner {

    ProjectRepository projectRepository;
    SprintRepository sprintRepository;

    @Override
    @Transactional
    public void run(String... args) {

        Project websiteRedesign = ensureProject("Website Redesign");
        Project mobileBanking = ensureProject("Mobile Banking App");
        Project hrPortal = ensureProject("Internal HR Portal");

        upsertSprint(
                websiteRedesign,
                "Sprint 1 - Discovery",
                "Map current user journeys and gather stakeholder requirements",
                LocalDate.of(2026, 1, 5),
                LocalDate.of(2026, 1, 16),
                SprintStatus.COMPLETED
        );

        upsertSprint(
                websiteRedesign,
                "Sprint 2 - Design System",
                "Deliver the shared component library and updated brand guidelines",
                LocalDate.of(2026, 1, 19),
                LocalDate.of(2026, 1, 30),
                SprintStatus.ACTIVE
        );

        upsertSprint(
                websiteRedesign,
                "Sprint 3 - Build",
                "Implement the new landing and product pages",
                LocalDate.of(2026, 2, 2),
                LocalDate.of(2026, 2, 13),
                SprintStatus.PLANNED
        );

        upsertSprint(
                mobileBanking,
                "Sprint 1 - Authentication",
                "Implement biometric login and OTP fallback",
                LocalDate.of(2026, 3, 2),
                LocalDate.of(2026, 3, 13),
                SprintStatus.COMPLETED
        );

        upsertSprint(
                mobileBanking,
                "Sprint 2 - Payments",
                "Add domestic transfers and bill payment flows",
                LocalDate.of(2026, 3, 16),
                LocalDate.of(2026, 3, 27),
                SprintStatus.ACTIVE
        );

        upsertSprint(
                mobileBanking,
                "Sprint 3 - Notifications",
                "Push notification centre and device management",
                LocalDate.of(2026, 3, 30),
                LocalDate.of(2026, 4, 10),
                SprintStatus.CANCELLED
        );

        upsertSprint(
                hrPortal,
                "Sprint 1 - Employee Directory",
                "Searchable directory with org chart view",
                LocalDate.of(2026, 4, 6),
                LocalDate.of(2026, 4, 17),
                SprintStatus.PLANNED
        );

        log.info("Ensured sample project and sprint data.");
    }

    private Project ensureProject(String name) {

        Project project = projectRepository.findByName(name).orElseGet(Project::new);

        project.setName(name);
        project.setIsActive(true);

        return projectRepository.save(project);
    }

    private void upsertSprint(
            Project project,
            String name,
            String sprintGoal,
            LocalDate startDate,
            LocalDate endDate,
            SprintStatus status
    ) {

        Sprint sprint = sprintRepository.findByProjectAndName(project, name)
                .orElseGet(Sprint::new);

        sprint.setProject(project);
        sprint.setName(name);
        sprint.setSprintGoal(sprintGoal);
        sprint.setStartDate(startDate.atStartOfDay());
        sprint.setEndDate(endDate.atStartOfDay());
        sprint.setStatus(status);
        sprint.setIsActive(true);

        sprintRepository.save(sprint);
    }
}
