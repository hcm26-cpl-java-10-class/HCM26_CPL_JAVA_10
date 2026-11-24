package com.example.starter_project_2025.system.exam.grading.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record ReturnForRevisionRequest(
        @NotBlank(message = "Revision note is required")
        @Size(max = 1000, message = "Revision note must not exceed 1000 characters")
        String note,

        Instant deadline
) {}
