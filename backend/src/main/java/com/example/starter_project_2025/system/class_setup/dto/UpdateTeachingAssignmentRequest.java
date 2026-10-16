package com.example.starter_project_2025.system.class_setup.dto;

import com.example.starter_project_2025.system.class_setup.AssignmentRole;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record UpdateTeachingAssignmentRequest(
        @NotNull(message = "trainerId không được để trống")
        Long trainerId,

        @NotNull(message = "role không được để trống")
        AssignmentRole role,

        @NotNull(message = "effectiveFrom không được để trống")
        LocalDate effectiveFrom,

        LocalDate effectiveTo
) {}
