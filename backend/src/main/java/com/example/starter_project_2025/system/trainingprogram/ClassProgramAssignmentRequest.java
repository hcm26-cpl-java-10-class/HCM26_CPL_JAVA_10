package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.constraints.NotNull;

public record ClassProgramAssignmentRequest(
        @NotNull Long programId
) {}
