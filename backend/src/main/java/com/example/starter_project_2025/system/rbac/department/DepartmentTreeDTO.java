package com.example.starter_project_2025.system.rbac.department;

import java.util.List;

/** Nút trong cây phòng ban (GET /api/departments/tree). */
public record DepartmentTreeDTO(
        Long id,
        String code,
        String name,
        Boolean isActive,
        List<DepartmentTreeDTO> children
) {
}
