package com.example.starter_project_2025.system.demo.enrollment;

import java.time.LocalDateTime;

public record DepartmentLogStudentDTO(
        Long studentId,
        String fullName,
        String email,
        String status,
        int progressPercentage,
        LocalDateTime enrolledAt
) {
}
