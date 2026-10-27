package com.example.starter_project_2025.system.project.sprint_backlog;

import java.time.Instant;
import java.util.UUID;

/**
 * Milestone the student can link a backlog item to (UFR-PRJ-003-02).
 * <p>
 * The backlog module only reads the milestone module, so the picker is served
 * through a small read-only projection instead of the heavier milestone
 * detail payload.
 *
 * @param id        milestone UUID, written back through
 *                  {@link SprintBacklogDTO#getMilestoneId()}
 * @param projectId owning project of the milestone
 * @param name      milestone title
 * @param label     display label (project prefix + title) used by the selector
 * @param status    lifecycle status of the milestone
 * @param dueDate   milestone deadline
 * @param mandatory whether the milestone is mandatory for the project
 */
public record BacklogMilestoneOptionDTO(
        UUID id,
        Long projectId,
        String name,
        String label,
        String status,
        Instant dueDate,
        boolean mandatory
) {
}
