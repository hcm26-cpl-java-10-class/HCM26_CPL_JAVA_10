package com.example.starter_project_2025.base.crud.controller;

import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentFilter;
import com.example.starter_project_2025.base.crud.service.DepartmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/departments")
public class DepartmentController extends BaseCrudController<UUID, DepartmentDTO, DepartmentFilter> {

    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService service) {
        super(service);
        this.departmentService = service;
    }

    @PostMapping("/create")
    public ResponseEntity<DepartmentDTO> createDepartment(@Valid @RequestBody DepartmentDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(departmentService.createDepartment(dto));
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<DepartmentDTO> updateDepartment(
            @PathVariable UUID id,
            @Valid @RequestBody DepartmentDTO dto) {
        return ResponseEntity.ok(departmentService.updateDepartment(id, dto));
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