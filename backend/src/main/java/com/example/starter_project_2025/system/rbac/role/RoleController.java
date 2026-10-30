package com.example.starter_project_2025.system.rbac.role;

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
@RequestMapping("/api/roles")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Role", description = "APIs for managing roles")
public class RoleController
        extends BaseCrudDataIoController<Role, Long, RoleDTO, RoleFilter> {

    RoleService roleService;
    RoleRepository roleRepository;

    @Override
    protected BaseCrudService<Long, RoleDTO, RoleFilter> getService() {
        return roleService;
    }

    @Override
    protected BaseCrudRepository<Role, Long> getRepository() {
        return roleRepository;
    }

    @Override
    protected Class<Role> getEntityClass() {
        return Role.class;
    }
}
