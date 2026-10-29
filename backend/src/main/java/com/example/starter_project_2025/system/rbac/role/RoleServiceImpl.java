package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleServiceImpl extends BaseCrudServiceImpl<Role, Long, RoleDTO, RoleFilter>
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
        // isSystem is backend-managed and cannot be enabled by a client request.
        role.setIsSystem(false);
        assignPermissions(role, request.getPermissionIds());
    }

    @Override
    protected void beforeUpdate(Role role, RoleDTO request, ValidationContext ctx) {
        if (request.getName() != null) {
            if (isBuiltInRole(role.getName()) && !role.getName().equalsIgnoreCase(request.getName().trim())) {
                ctx.add("name", "Built-in roles ADMIN, STUDENT, and TEACHER cannot be renamed");
            }
            validateRoleNameUnique(request.getName(), role.getId(), ctx);
        }
        if (request.getPermissionIds() != null) {
            validatePermissions(request.getPermissionIds(), ctx);
            assignPermissions(role, request.getPermissionIds());
        }
    }

    @Override
    protected void beforeDelete(Role role) {
        if (Boolean.TRUE.equals(role.getIsSystem())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "System role '" + role.getName() + "' cannot be deleted");
        }
        if (userRepository.existsByRoles_Id(role.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Role '" + role.getName() + "' is assigned to users and cannot be deleted");
        }
    }

    @Override
    public Page<RoleDTO> getAll(org.springframework.data.domain.Pageable pageable, String search, RoleFilter filter) {
        return super.getAll(pageable, search, filter).map(this::addUserCount);
    }

    @Override
    public RoleDTO getById(Long id) {
        return addUserCount(super.getById(id));
    }

    @Override
    public RoleDTO create(RoleDTO request) {
        return addUserCount(super.create(request));
    }

    @Override
    public RoleDTO update(Long id, RoleDTO request) {
        return addUserCount(super.update(id, request));
    }

    @Override
    public Set<Long> getPermissionIds(Long roleId) {
        check("ROLE_READ");
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
        return role.getPermissions().stream().map(Permission::getId).collect(Collectors.toSet());
    }

    @Override
    public RoleDTO updatePermissions(Long roleId, Set<Long> permissionIds) {
        check("ROLE_UPDATE");
        ValidationContext ctx = new ValidationContext();
        validatePermissions(permissionIds, ctx);
        ctx.throwIfErrors();

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
        assignPermissions(role, permissionIds);
        return addUserCount(roleMapper.toResponse(roleRepository.save(role)));
    }

    @Override
    public RoleDTO setSystemRole(Long roleId, boolean isSystem) {
        // Use the same authority mechanism as the existing RBAC service, rather than
        // trusting that the frontend hides the switch from unauthorized users.
        check("ROLE_UPDATE");

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));

        if (isBuiltInRole(role.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The built-in role '" + role.getName() + "' cannot have its system status changed");
        }

        role.setIsSystem(isSystem);
        Role saved = roleRepository.save(role);
        return addUserCount(roleMapper.toResponse(saved));
    }

    private boolean isBuiltInRole(String name) {
        return name != null && (name.equalsIgnoreCase("ADMIN")
                || name.equalsIgnoreCase("STUDENT")
                || name.equalsIgnoreCase("TEACHER"));
    }

    private RoleDTO addUserCount(RoleDTO dto) {
        if (dto != null && dto.getId() != null) {
            dto.setUserCount(userRepository.countByRoles_Id(dto.getId()));
        }
        return dto;
    }

    private void validateRoleNameUnique(String name, Long currentId, ValidationContext ctx) {
        if (name == null || name.isBlank()) return;
        Optional<Role> existing = roleRepository.findByName(name.trim());
        if (existing.isPresent() && (currentId == null || !existing.get().getId().equals(currentId))) {
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

    private void assignPermissions(Role role, Set<Long> permissionIds) {
        Set<Permission> permissions = new HashSet<>(permissionRepository.findAllById(permissionIds));
        role.getPermissions().clear();
        role.getPermissions().addAll(permissions);
    }
}
