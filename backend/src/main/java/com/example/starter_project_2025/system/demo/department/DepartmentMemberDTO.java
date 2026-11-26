package com.example.starter_project_2025.system.demo.department;

public record DepartmentMemberDTO(
        Long id,
        String email,
        String firstName,
        String lastName,
        Long departmentId,
        String departmentName
) {
}
