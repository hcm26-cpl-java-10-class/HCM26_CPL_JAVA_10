package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
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
    UserRepository userRepository;

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

        role.setIsSystem(false);
        assignPermissions(role, request.getPermissionIds());
    }

    @Override
    public RoleDTO create(RoleDTO request) {
        RoleDTO response = super.create(request);
        response.setUserCount(userRepository.countByRolesId(response.getId()));
        return response;
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

    @Override
    public RoleDTO update(Long id, RoleDTO request) {
        RoleDTO response = super.update(id, request);
        response.setUserCount(userRepository.countByRolesId(id));
        return response;
    }

    @Override
    public RoleDTO getById(Long id) {
        RoleDTO response = super.getById(id);
        response.setUserCount(userRepository.countByRolesId(id));
        return response;
    }

    @Override
    protected void beforeDelete(Role role) {
        if (Boolean.TRUE.equals(role.getIsSystem())) {
            throw new BadRequestException("Không thể xóa vai trò mặc định của hệ thống!");
        }

        if (userRepository.countByRolesId(role.getId()) > 0) {
            throw new BadRequestException("Không thể xóa vai trò đang được gán cho người dùng!");
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
            return;
        }

        long found = permissionRepository.countByIdIn(permissionIds);

        if (found != permissionIds.size()) {
            ctx.add("permissionIds", "One or more permissions are invalid");
        }
    }

    private Set<Permission> getPermissions(Set<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new HashSet<>();
        }
        return new HashSet<>(permissionRepository.findAllById(ids));
    }

    private void assignPermissions(Role role, Set<Long> permissionIds) {

        Set<Permission> permissions = getPermissions(permissionIds);

        role.getPermissions().clear();
        role.getPermissions().addAll(permissions);
    }
}
