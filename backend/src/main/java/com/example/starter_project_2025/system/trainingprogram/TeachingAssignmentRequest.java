package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;

public record TeachingAssignmentRequest(
        @NotNull(message = "Select a class.") @Positive(message = "Select a valid class.") Long classId,
        @NotNull(message = "Select a subject.") @Positive(message = "Select a valid subject.") Long programSubjectId,
        @NotNull(message = "Select a trainer.") @Positive(message = "Select a valid trainer.") Long trainerId,
        @NotNull(message = "Select a role.") AssignmentRole role,
        @NotNull(message = "Enter the effective start date.") LocalDate effectiveFrom,
        LocalDate effectiveTo,
        @PositiveOrZero Long revision
) {
    public TeachingAssignmentRequest(Long classId, Long programSubjectId, Long trainerId, AssignmentRole role,
                                     LocalDate effectiveFrom, LocalDate effectiveTo) {
        this(classId, programSubjectId, trainerId, role, effectiveFrom, effectiveTo, null);
    }
}
