package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO;

import java.util.List;


public record DepartmentBatchItemResultDTO(
        Long departmentId,
        String departmentName,
        long studentCount,
        long alreadyEnrolled,
        long newEnrollments,
        long excludedCount,
        List<DepartmentMemberDTO> newMembers,
        List<DepartmentMemberDTO> alreadyEnrolledMembers,
        List<DepartmentMemberDTO> excludedMembers
) {
}
