package com.example.starter_project_2025.system.class_setup.dto;

import com.example.starter_project_2025.system.class_setup.AssignmentRole;

import java.time.LocalDate;
import java.util.List;

public record ClassProgramSubjectResponse(
        Long programSubjectId,
        Long subjectId,
        String subjectCode,
        String subjectName,
        Integer durationHours,
        Integer orderIndex,
        List<TrainerAssignmentInfo> assignments
) {
    public record TrainerAssignmentInfo(
            Long id,
            Long trainerId,
            String trainerName,
            String trainerEmail,
            AssignmentRole role,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            Boolean isActive
    ) {}
}
