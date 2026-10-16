package com.example.starter_project_2025.system.class_setup.dto;

import com.example.starter_project_2025.system.class_setup.EnrollmentStatus;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record EnrollmentRequest(
        @NotNull(message = "studentId không được để trống")
        Long studentId,

        LocalDate enrolledAt,

        EnrollmentStatus status
) {}
