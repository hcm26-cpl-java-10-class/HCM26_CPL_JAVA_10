package com.example.starter_project_2025.system.demo.enrollment;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record DepartmentSelection(
        @NotNull(message = "Department ID is required") Long departmentId,
        List<Long> excludedStudentIds
) {
}
