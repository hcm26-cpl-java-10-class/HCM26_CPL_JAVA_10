package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentRequest;

import java.util.List;
import java.util.UUID;

public interface DepartmentService extends BaseCrudService<Department, UUID, DepartmentDTO, DepartmentRequest, DepartmentRequest> {

    DepartmentDTO createDepartment(DepartmentRequest request);

    DepartmentDTO updateDepartment(UUID id, DepartmentRequest request);

    List<DepartmentDTO> getDepartmentTree();

    void changeStatus(UUID id, String status);
}