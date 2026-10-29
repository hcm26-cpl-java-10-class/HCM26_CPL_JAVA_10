package com.example.trainingprogram.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ProgramSubjectRequest(
    @NotNull Long subjectId,
    @NotNull @Positive Integer orderIndex
) {}
