package com.example.starter_project_2025.system.project;

import java.time.LocalDate;

/**
 * Read model used by the sprint form to pick the parent project
 * (UFR-PRJ-003-01: "liên kết với milestone/project").
 */
public record ProjectDTO(
        Long id,
        String name,
        LocalDate startDate,
        LocalDate endDate,
        Boolean isActive
) {

    public static ProjectDTO from(Project project) {
        return new ProjectDTO(
                project.getId(),
                project.getName(),
                project.getStartDate(),
                project.getEndDate(),
                project.getIsActive()
        );
    }
}
