package com.example.starter_project_2025.system.demo.enrollment;

/**
 * Học viên (role STUDENT, đang active) thuộc một lớp — nguồn danh sách để mời dự thi hàng loạt.
 */
public record CourseStudentDTO(
        Long id,
        String email,
        String firstName,
        String lastName,
        String fullName
) {
}
