package com.example.starter_project_2025.system.project.sprint;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Snapshot of the Sprint Planning board (UFR-PRJ-003-03).
 * <p>
 * It combines the sprint header, the ordered Sprint Backlog and the items that
 * are still available in the product backlog, so the UI can render both panels
 * and build the drag &amp; drop view from a single response.
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
