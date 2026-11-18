package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Backlog item as rendered by the Sprint Planning / Backlog board
 * (UFR-PRJ-003-03).
 * <p>
 * The board is fed by the {@code sprint_backlog} module: the sprint panel is
 * the list of items assigned to the planned sprint, while the product backlog
 * panel only lists items that are not assigned to any sprint yet
 * ({@link SprintBacklog#getSprint()} is {@code null}).
 * <p>
 * The payload keeps the fields the board renders, including the milestone the
 * item is linked to (UFR-PRJ-003-02): the board groups / warns by milestone
 * deadline, so the name and the due date are part of the projection.
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
        UUID milestoneId,
        String milestoneName,
        LocalDate milestoneDueDate,
        Double estimatedHours,
        Integer sprintOrder
) {

    /**
     * Translates the {@link SprintBacklogStatus} lifecycle into the board
     * statuses shared with the UI: {@code TODO}, {@code IN_PROGRESS},
     * {@code REVIEW} and {@code DONE}.
     * <p>
     * The statuses match the columns of the workspace Kanban board, so the
     * Backlog board and the Kanban board never disagree.
     */
    public static String toBoardStatus(SprintBacklogStatus status) {

        if (status == null) {
            return "TODO";
        }

        return status.name();
    }

    public static SprintPlanningItemDTO from(SprintBacklog backlog, Long projectId, int position) {

        Milestone milestone = backlog.getMilestone();

        return new SprintPlanningItemDTO(
                backlog.getId(),
                backlog.getTitle(),
                backlog.getDescription(),
                backlog.getPriority() == null ? null : backlog.getPriority().name(),
                toBoardStatus(backlog.getStatus()),
                backlog.getProjectId() != null ? backlog.getProjectId() : projectId,
                milestone == null ? null : milestone.getId(),
                milestone == null ? null : milestone.getTitle(),
                milestone == null || milestone.getDeadline() == null
                        ? null
                        : milestone.getDeadline().atZone(ZoneOffset.UTC).toLocalDate(),
                backlog.getEstimatedHours(),
                position
        );
    }
}
