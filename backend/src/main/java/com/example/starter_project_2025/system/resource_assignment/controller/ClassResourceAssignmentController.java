package com.example.starter_project_2025.system.resource_assignment.controller;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.system.resource_assignment.dto.ClassResourceAssignmentDTO;
import com.example.starter_project_2025.system.resource_assignment.dto.ClassResourceAssignmentFilter;
import com.example.starter_project_2025.system.resource_assignment.service.ClassResourceAssignmentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/resource-assignments")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Resource Assignment", description = "APIs for assigning resources to classes")
public class ClassResourceAssignmentController extends BaseCrudController<Long, ClassResourceAssignmentDTO, ClassResourceAssignmentFilter> {

    ClassResourceAssignmentService service;

    @Override
    protected BaseCrudService<Long, ClassResourceAssignmentDTO, ClassResourceAssignmentFilter> getService() {
        return service;
    }

    @Override
    @GetMapping
    @Operation(summary = "Tra cứu danh sách nguồn lực đã gán cho lớp")
    public ResponseEntity<Page<ClassResourceAssignmentDTO>> getAll(
            @PageableDefault Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute ClassResourceAssignmentFilter filter
    ) {
        return super.getAll(pageable, search, filter);
    }

    @Override
    @GetMapping("/{id}")
    @Operation(summary = "Lấy thông tin chi tiết một phân công theo ID")
    public ResponseEntity<ClassResourceAssignmentDTO> getById(@PathVariable Long id) {
        return super.getById(id);
    }

    @Override
    @PostMapping
    @Operation(summary = "Gán nguồn lực (Trainer, Admin, Course) vào lớp học")
    public ResponseEntity<ClassResourceAssignmentDTO> create(
            @Validated(OnCreate.class) @RequestBody ClassResourceAssignmentDTO request
    ) {
        return super.create(request);
    }

    @Override
    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật thông tin phân công")
    public ResponseEntity<ClassResourceAssignmentDTO> update(
            @PathVariable Long id,
            @Validated(OnUpdate.class) @RequestBody ClassResourceAssignmentDTO request
    ) {
        return super.update(id, request);
    }

    @Override
    @DeleteMapping("/{id}")
    @Operation(summary = "Bỏ gán (xóa) nguồn lực khỏi lớp học")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return super.delete(id);
    }
}