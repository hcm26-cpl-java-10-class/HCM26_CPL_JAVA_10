package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;

import java.time.LocalDate;

/**
 * Backlog item as rendered by the Sprint Planning / Backlog board
 * (UFR-PRJ-003-03).
 * <p>
 * The board is fed by the {@code sprint_backlog} module: the sprint panel is
 * the list of items assigned to the planned sprint, while the product backlog
 * panel only lists items that are not assigned to any sprint yet
 * ({@link SprintBacklog#getSprint()} is {@code null}).
 * <p>
 * The payload keeps the fields the board renders. Milestone data is not
 * modelled by the Sprint Backlog module yet, so it is always {@code null} and
 * the UI simply hides it.
 *
 * @param sprintOrder 1-based position of the item inside the sprint panel.
 */
public record SprintPlanningItemDTO(
        Long id,
        String title,
        String description,
        String priority,
        String status,
        Long projectId,
        Long milestoneId,
        String milestoneName,
        LocalDate milestoneDueDate,
        Double estimatedHours,
        Integer sprintOrder
) {

    /**
     * Translates the {@link SprintBacklogStatus} lifecycle into the board
     * buckets shared with the UI: {@code SPRINT_BACKLOG} (rendered "To Do"),
     * {@code IN_PROGRESS} and {@code DONE}.
     * <p>
     * {@code REVIEW} is still ongoing work, so it is shown as
     * {@code IN_PROGRESS}.
     */
    public static String toBoardStatus(SprintBacklogStatus status) {

        if (status == null) {
            return "SPRINT_BACKLOG";
        }

        return switch (status) {
            case TODO -> "SPRINT_BACKLOG";
            case IN_PROGRESS, REVIEW -> "IN_PROGRESS";
            case DONE -> "DONE";
        };
    }

    public static SprintPlanningItemDTO from(SprintBacklog backlog, Long projectId, int position) {

        return new SprintPlanningItemDTO(
                backlog.getId(),
                backlog.getTitle(),
                backlog.getDescription(),
                backlog.getPriority() == null ? null : backlog.getPriority().name(),
                toBoardStatus(backlog.getStatus()),
                projectId,
                null,
                null,
                null,
                backlog.getEstimatedHours(),
                position
        );
    }
}
