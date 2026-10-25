package com.example.starter_project_2025.system.project.trainingclass;

public record TrainingClassListItem(
        Long id,
        String code,
        String name,
        Long programId,
        String programName,
        Long cohortId,
        String cohortName,
        Long tenantId,
        Long mentorId,
        TrainingClassStatus status,
        long memberCount
) {
}
