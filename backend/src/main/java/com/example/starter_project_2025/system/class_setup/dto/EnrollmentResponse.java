package com.example.starter_project_2025.system.class_setup.dto;

import com.example.starter_project_2025.system.class_setup.EnrollmentStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record EnrollmentResponse(
        Long id,
        Long studentId,
        String studentName,
        String studentEmail,
        Long classId,
        String classCode,
        LocalDate enrolledAt,
        EnrollmentStatus status,
        Boolean isActive,
        LocalDateTime createdAt
) {}
