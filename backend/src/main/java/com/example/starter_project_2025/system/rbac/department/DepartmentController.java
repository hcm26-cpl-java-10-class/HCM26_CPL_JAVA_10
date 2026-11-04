package com.example.starter_project_2025.system.rbac.department;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/departments")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Department", description = "APIs for managing departments")
public class DepartmentController
        extends BaseCrudDataIoController<Department, Long, DepartmentDTO, DepartmentFilter> {

    DepartmentService departmentService;
    DepartmentRepository departmentRepository;

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
    public ResponseEntity<List<DepartmentTreeDTO>> getTree() {
        return ResponseEntity.ok(departmentService.getTree());
    }
}
