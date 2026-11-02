package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.LocalDate;

public record TeachingAssignmentEndRequest(
        @NotNull(message = "Enter the effective end date.") LocalDate effectiveTo,
        @NotNull(message = "Reload the current assignment before retrying.") @PositiveOrZero Long revision
) {}
