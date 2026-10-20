package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentFilter;

import java.util.List;

public interface DepartmentService extends BaseCrudService<Long, DepartmentDTO, DepartmentFilter> {

    List<DepartmentDTO> getDepartmentTree();
}