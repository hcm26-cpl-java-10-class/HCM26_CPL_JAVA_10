package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record TeachingAssignmentRequest(
        @NotNull @jakarta.validation.constraints.Positive Long classId,
        @NotNull @jakarta.validation.constraints.Positive Long programSubjectId,
        @NotNull @jakarta.validation.constraints.Positive Long trainerId,
        @NotNull AssignmentRole role,
        @NotNull LocalDate effectiveFrom,
        LocalDate effectiveTo
) {}
