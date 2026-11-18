package com.example.starter_project_2025.system.demo.enrollment;

public record DepartmentEnrollmentResultDTO(
        Long departmentId,
        Long courseId,
        String courseName,
        long studentCount,
        long alreadyEnrolled,
        long newEnrollments
) {
}
