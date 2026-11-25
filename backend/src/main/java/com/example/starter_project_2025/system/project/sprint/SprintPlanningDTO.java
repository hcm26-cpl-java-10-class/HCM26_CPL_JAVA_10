package com.example.starter_project_2025.system.project.sprint;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Snapshot of the Sprint Planning board (UFR-PRJ-003-03).
 * <p>
 * It combines the sprint header and the ordered Sprint Backlog of the sprint,
 * so the UI can render the board from a single response.
 * <p>
 * The "product backlog" panel only lists the items that are not assigned to any
 * sprint yet ({@code sprint_backlog.sprint_id} is {@code null}); confirming the
 * board moves them into the planned sprint.
 *
 * @param canPlan       {@code true} only while the sprint is Planned or Active;
 *                      a completed / cancelled sprint locks its backlog scope.
 * @param statusMessage warning shown by the UI when {@code canPlan} is false.
 */
public record SprintPlanningDTO(
        Long sprintId,
        String sprintName,
        String sprintGoal,
        SprintStatus status,
        LocalDateTime startDate,
        LocalDateTime endDate,
        Long projectId,
        boolean canPlan,
        String statusMessage,
        List<SprintPlanningItemDTO> sprintItems,
        List<SprintPlanningItemDTO> productBacklogItems
) {
}
