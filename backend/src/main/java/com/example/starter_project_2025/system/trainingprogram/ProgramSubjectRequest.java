package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ProgramSubjectRequest(
        @NotNull @Positive Long subjectId,
        @NotNull @Positive Integer orderIndex
) {}
