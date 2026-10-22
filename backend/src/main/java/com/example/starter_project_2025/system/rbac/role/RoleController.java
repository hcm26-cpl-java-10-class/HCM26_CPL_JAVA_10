package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/roles")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Role", description = "APIs for managing roles")
public class RoleController extends BaseCrudDataIoController<Role, Long, RoleDTO, RoleFilter> {

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

    @GetMapping("/{id}/permissions")
    public ResponseEntity<Set<Long>> getRolePermissionIds(@PathVariable Long id) {
        return ResponseEntity.ok(roleService.getPermissionIds(id));
    }

    @PutMapping("/{id}/permissions")
    public ResponseEntity<RoleDTO> updateRolePermissions(
            @PathVariable Long id,
            @RequestBody Set<Long> permissionIds) {
        return ResponseEntity.ok(roleService.updatePermissions(id, permissionIds));
    }

    /** Toggle the system-role flag through a dedicated, permission-checked endpoint. */
    @PatchMapping("/{id}/system-role")
    public ResponseEntity<RoleDTO> setSystemRole(
            @PathVariable Long id,
            @RequestParam boolean isSystem) {
        return ResponseEntity.ok(roleService.setSystemRole(id, isSystem));
    }
}
