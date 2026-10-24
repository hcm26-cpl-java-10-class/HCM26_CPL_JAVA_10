package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.system.project.backlog_temp.Milestone;
import com.example.starter_project_2025.system.project.backlog_temp.Task;
import com.example.starter_project_2025.system.project.backlog_temp.TaskPriority;
import com.example.starter_project_2025.system.project.backlog_temp.TaskStatus;

import java.time.LocalDate;

/**
 * Backlog item as rendered by the Sprint Planning board (UFR-PRJ-003-03).
 * <p>
 * Besides the item itself the payload carries the Milestone information so the
 * student can see whether an item stays compatible with the milestone deadline
 * before assigning it to the sprint.
 */
public record SprintPlanningItemDTO(
        Long id,
        String title,
        String description,
        TaskPriority priority,
        TaskStatus status,
        Long projectId,
        Long milestoneId,
        String milestoneName,
        LocalDate milestoneDueDate,
        Double estimatedHours,
        Integer sprintOrder
) {

    public static SprintPlanningItemDTO from(Task task, Milestone milestone) {
        return new SprintPlanningItemDTO(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getPriority(),
                task.getStatus(),
                task.getProjectId(),
                task.getMilestoneId(),
                milestone != null ? milestone.getName() : null,
                milestone != null ? milestone.getDueDate() : null,
                task.getEstimatedHours(),
                task.getSprintOrder()
        );
    }
}
