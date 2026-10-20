package com.example.starter_project_2025.base.crud.controller;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.domain.DepartmentRepository;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentFilter;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.service.DepartmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/departments")
public class DepartmentController
        extends BaseCrudDataIoController<Department, Long, DepartmentDTO, DepartmentFilter> {

    private final DepartmentService departmentService;
    private final DepartmentRepository departmentRepository;

    public DepartmentController(DepartmentService departmentService, DepartmentRepository departmentRepository) {
        this.departmentService = departmentService;
        this.departmentRepository = departmentRepository;
    }

    @Override
    protected BaseCrudService<Long, DepartmentDTO, DepartmentFilter> getService() {
        return departmentService;
    }

    @Override
    protected BaseCrudRepository<Department, Long> getRepository() {
        return departmentRepository;
    }

    @Override
    protected Class<Department> getEntityClass() {
        return Department.class;
    }

    @GetMapping("/tree")
    public ResponseEntity<List<DepartmentDTO>> getDepartmentTree() {
        return ResponseEntity.ok(departmentService.getDepartmentTree());
    }
}