package com.example.starter_project_2025.init;

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
 * Seeds sample {@link Sprint} rows, following the same idempotent upsert
 * pattern used by {@link RoleDataInitializer}.
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

    /**
     * Demo project every seeded sprint belongs to. The milestone demo data is
     * seeded for the same project id, so backlog items can link a milestone of
     * their own project (UFR-PRJ-003-02).
     */
    static final long DEMO_PROJECT_ID = 1L;

    SprintRepository sprintRepository;

    @Override
    @Transactional
    public void run(String... args) {

        // Only one demo project timeline: Sprint 1 is running right now, the
        // next two sprints are still planned.
        upsertSprint(
                "Sprint 1 - Discovery",
                "Map current user journeys and gather stakeholder requirements",
                LocalDate.of(2026, 10, 19),
                LocalDate.of(2026, 10, 30),
                SprintStatus.ACTIVE
        );

        upsertSprint(
                "Sprint 2 - Design System",
                "Deliver the shared component library and updated brand guidelines",
                LocalDate.of(2026, 11, 2),
                LocalDate.of(2026, 11, 13),
                SprintStatus.PLANNED
        );

        upsertSprint(
                "Sprint 3 - Build",
                "Implement the new landing and product pages",
                LocalDate.of(2026, 11, 16),
                LocalDate.of(2026, 11, 27),
                SprintStatus.PLANNED
        );

        log.info("Ensured sample sprint data.");
    }

    private void upsertSprint(
            String name,
            String sprintGoal,
            LocalDate startDate,
            LocalDate endDate,
            SprintStatus status
    ) {

        Sprint sprint = sprintRepository.findFirstByProjectIdAndNameOrderByIdAsc(DEMO_PROJECT_ID, name)
                .orElseGet(Sprint::new);

        sprint.setName(name);
        sprint.setSprintGoal(sprintGoal);
        sprint.setProjectId(DEMO_PROJECT_ID);
        sprint.setStartDate(startDate.atStartOfDay());
        sprint.setEndDate(endDate.atStartOfDay());
        sprint.setStatus(status);
        sprint.setIsActive(true);

        sprintRepository.save(sprint);
    }
}
