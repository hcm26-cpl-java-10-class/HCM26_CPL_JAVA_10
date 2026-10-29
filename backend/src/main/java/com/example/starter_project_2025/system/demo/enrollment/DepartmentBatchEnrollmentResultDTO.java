package com.example.starter_project_2025.system.demo.enrollment;

import java.util.List;

public record DepartmentBatchEnrollmentResultDTO(
        Long courseId,
        String courseName,
        long totalNewEnrollments,
        long totalAlreadyEnrolled,
        List<DepartmentBatchItemResultDTO> departments
) {
}
