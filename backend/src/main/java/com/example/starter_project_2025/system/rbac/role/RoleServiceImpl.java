package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
<<<<<<< Updated upstream
=======
import com.example.starter_project_2025.exception.ResourceNotFoundException;
>>>>>>> Stashed changes
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleServiceImpl
        extends BaseCrudServiceImpl<Role, Long, RoleDTO, RoleFilter>
        implements RoleService {

    public static final List<String> PROTECTED_ROLES =
            List.of("ADMIN", "ROLE_SYSTEM_ADMIN");

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
    public Page<RoleDTO> searchRoles(String keyword, Pageable pageable) {
        check("ROLE_READ");
        return roleRepository.searchByKeyword(keyword, pageable)
                .map(roleMapper::toResponse);
    }

    @Override
    public RoleDTO updateRoleStatus(Long id, boolean isActive) {
        check("ROLE_UPDATE");
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        if (!isActive && isProtectedRole(role)) {
            throw new BadRequestException("System roles (ADMIN) cannot be deactivated.");
        }

        role.setIsActive(isActive);
        return roleMapper.toResponse(roleRepository.save(role));
    }

    @Override
    public void deleteRole(Long id) {
        delete(id);
    }

    @Override
    protected void beforeDelete(Role role) {
        if (isProtectedRole(role)) {
            throw new BadRequestException(
                    "System roles (ADMIN) cannot be deleted to prevent system lockout.");
        }
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
        request.setIsSystem(role.getIsSystem());

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

    private boolean isProtectedRole(Role role) {
        return role.getName() != null
                && PROTECTED_ROLES.contains(role.getName().toUpperCase(Locale.ROOT));
    }
}
