package com.example.starter_project_2025.system.rbac.permission;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/permissions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Permission", description = "APIs for managing permissions")
public class PermissionController
        extends BaseCrudDataIoController<Permission, Long, PermissionDTO, PermissionFilter> {

    PermissionService permissionService;
    PermissionRepository permissionRepository;

    @Override
    protected BaseCrudService<Long, PermissionDTO, PermissionFilter> getService() {
        return permissionService;
    }

    @Override
    protected BaseCrudRepository<Permission, Long> getRepository() {
        return permissionRepository;
    }

    @Override
    protected Class<Permission> getEntityClass() {
        return Permission.class;
    }
}
