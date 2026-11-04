package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record TeachingAssignmentRequest(
        @NotNull Long classId,
        @NotNull Long programSubjectId,
        @NotNull Long trainerId,
        @NotNull AssignmentRole role,
        @NotNull LocalDate effectiveFrom,
        LocalDate effectiveTo
) {}
