package com.example.starter_project_2025.system.project.backlog_temp;

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
 * Seeds the temporary milestone catalog used by the backlog item use case.
 * <p>
 * Runs before {@code TaskDataInitializer} (@Order(13)) so the sample backlog
 * items can be linked to real milestones of their own project. The upsert is
 * idempotent (existing rows are updated instead of duplicated).
 */
@Slf4j
@Order(12)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MilestoneDataInitializer implements CommandLineRunner {

    MilestoneRepository milestoneRepository;

    @Override
    @Transactional
    public void run(String... args) {

        // Project 1 - Discovery / Design / Build (aligned with the sprint seed)
        upsertMilestone(1L, "M1 - Discovery",
                "Research, interviews and requirement consolidation",
                LocalDate.of(2026, 10, 30), MilestoneStatus.ACTIVE);
        upsertMilestone(1L, "M2 - Design System",
                "Shared component library and brand guidelines",
                LocalDate.of(2026, 11, 13), MilestoneStatus.PLANNED);
        upsertMilestone(1L, "M3 - Legacy Rollout",
                "Migration of the legacy pages (cancelled)",
                LocalDate.of(2026, 12, 4), MilestoneStatus.CANCELLED);

        // Project 2 - Authentication / Payments
        upsertMilestone(2L, "M1 - Authentication",
                "Biometric login with OTP fallback",
                LocalDate.of(2026, 3, 13), MilestoneStatus.ACTIVE);
        upsertMilestone(2L, "M2 - Payments",
                "Domestic transfers and bill payments",
                LocalDate.of(2026, 3, 27), MilestoneStatus.ACTIVE);

        // Project 3 - Employee Directory
        upsertMilestone(3L, "M1 - Employee Directory",
                "Searchable employee directory with org chart",
                LocalDate.of(2026, 4, 17), MilestoneStatus.PLANNED);

        log.info("Ensured sample milestone data for the temporary backlog module.");
    }

    private void upsertMilestone(Long projectId,
                                 String name,
                                 String description,
                                 LocalDate dueDate,
                                 MilestoneStatus status) {

        Milestone milestone = milestoneRepository
                .findByProjectIdAndNameIgnoreCase(projectId, name)
                .orElseGet(Milestone::new);

        milestone.setProjectId(projectId);
        milestone.setName(name);
        milestone.setDescription(description);
        milestone.setDueDate(dueDate);
        milestone.setStatus(status);

        milestoneRepository.save(milestone);
    }
}
