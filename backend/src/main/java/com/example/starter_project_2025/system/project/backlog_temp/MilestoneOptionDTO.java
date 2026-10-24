package com.example.starter_project_2025.system.project.backlog_temp;

import java.time.LocalDate;

/**
 * Option rendered in the milestone selector of the backlog item form
 * (UFR-PRJ-003-02, AC01 "chọn Milestone liên kết").
 * <p>
 * The {@code label} already contains the project so two milestones with the
 * same name in different projects stay distinguishable.
 */
public record MilestoneOptionDTO(
        Long id,
        Long projectId,
        String name,
        String label,
        MilestoneStatus status,
        LocalDate dueDate
) {

    public static MilestoneOptionDTO from(Milestone milestone) {
        return new MilestoneOptionDTO(
                milestone.getId(),
                milestone.getProjectId(),
                milestone.getName(),
                milestone.getName() + " (Project " + milestone.getProjectId() + ")",
                milestone.getStatus(),
                milestone.getDueDate()
        );
    }
}
