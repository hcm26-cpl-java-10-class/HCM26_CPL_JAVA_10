package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleServiceImpl
        extends BaseCrudServiceImpl<Role, Long, RoleDTO, RoleFilter>
        implements RoleService {

    RoleMapper roleMapper;
    RoleRepository roleRepository;
    PermissionRepository permissionRepository;

    @Override
    protected BaseCrudRepository<Role, Long> getRepository() {
        return roleRepository;
    }

    @Override
    protected BaseCrudMapper<Role, RoleDTO> getMapper() {
        return roleMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"name", "description"};
    }

    @Override
    protected void beforeCreate(Role role, RoleDTO request, ValidationContext ctx) {

        validateRoleNameUnique(request.getName(), null, ctx);
        validatePermissions(request.getPermissionIds(), ctx);

        assignPermissions(role, request.getPermissionIds());
    }

    @Override
    protected void beforeUpdate(Role role, RoleDTO request, ValidationContext ctx) {

        if (request.getName() != null) {
            validateRoleNameUnique(request.getName(), role.getId(), ctx);
        }

        if (request.getPermissionIds() != null) {
            validatePermissions(request.getPermissionIds(), ctx);
        }

        if (request.getPermissionIds() != null) {
            assignPermissions(role, request.getPermissionIds());
        }
    }

    private void validateRoleNameUnique(String name, Long currentId, ValidationContext ctx) {

        Optional<Role> existing = roleRepository.findByName(name);

        if (existing.isPresent()
                && (currentId == null || !existing.get().getId().equals(currentId))) {

            ctx.add("name", "Role name already exists");
        }
    }

    private void validatePermissions(Set<Long> permissionIds, ValidationContext ctx) {

        if (permissionIds == null || permissionIds.isEmpty()) {
            ctx.add("permissionIds", "At least one permission must be assigned");
            return;
        }

        long found = permissionRepository.countByIdIn(permissionIds);

        if (found != permissionIds.size()) {
            ctx.add("permissionIds", "One or more permissions are invalid");
        }
    }

    private Set<Permission> getPermissions(Set<Long> ids) {
        return new HashSet<>(permissionRepository.findAllById(ids));
    }

    private void assignPermissions(Role role, Set<Long> permissionIds) {

        Set<Permission> permissions = getPermissions(permissionIds);

        role.getPermissions().clear();
        role.getPermissions().addAll(permissions);
    }
}
