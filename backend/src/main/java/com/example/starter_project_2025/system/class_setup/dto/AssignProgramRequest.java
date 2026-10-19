package com.example.starter_project_2025.system.class_setup.dto;

import jakarta.validation.constraints.NotNull;

public record AssignProgramRequest(
        @NotNull(message = "programId không được để trống")
        Long programId
) {}
