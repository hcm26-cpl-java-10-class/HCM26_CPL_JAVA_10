package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentFilter;

import java.util.List;
import java.util.UUID;

public interface DepartmentService extends BaseCrudService<Department, UUID, DepartmentDTO, DepartmentFilter> {

    DepartmentDTO createDepartment(DepartmentDTO dto);

    DepartmentDTO updateDepartment(UUID id, DepartmentDTO dto);

    List<DepartmentDTO> getDepartmentTree();

    void changeStatus(UUID id, DepartmentStatus status);
}