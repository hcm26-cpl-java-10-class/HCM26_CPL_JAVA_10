package com.example.starter_project_2025.base.crud.controller;

import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentRequest;
import com.example.starter_project_2025.base.crud.service.DepartmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/departments")
public class DepartmentController extends BaseCrudController<UUID, DepartmentDTO, DepartmentRequest> {

    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService service) {
        super(service);
        this.departmentService = service;
    }

    @PostMapping("/create")
    public ResponseEntity<DepartmentDTO> createDepartment(@Valid @RequestBody DepartmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(departmentService.createDepartment(request));
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<DepartmentDTO> updateDepartment(
            @PathVariable UUID id,
            @Valid @RequestBody DepartmentRequest request) {
        return ResponseEntity.ok(departmentService.updateDepartment(id, request));
    }

    @GetMapping("/tree")
    public ResponseEntity<List<DepartmentDTO>> getDepartmentTree() {
        return ResponseEntity.ok(departmentService.getDepartmentTree());
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Void> changeStatus(
            @PathVariable UUID id,
            @RequestParam DepartmentStatus status) {
        departmentService.changeStatus(id, status);
        return ResponseEntity.noContent().build();
    }
}