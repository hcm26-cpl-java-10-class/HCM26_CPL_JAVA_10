package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleServiceImpl
        extends BaseCrudServiceImpl<Role, Long, RoleDTO, RoleFilter>
        implements RoleService {

    private static final List<String> PROTECTED_ROLES =
            List.of("ADMIN", "ROLE_SYSTEM_ADMIN");

    RoleMapper roleMapper;
    RoleRepository roleRepository;
    PermissionRepository permissionRepository;
    UserRepository userRepository;
    ParserFactory parserFactory;

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
        if (keyword == null || keyword.isBlank()) {
            return roleRepository.findAll(pageable)
                    .map(roleMapper::toResponse);
        }

        String pattern = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
        Specification<Role> specification = (root, query, criteriaBuilder) ->
                criteriaBuilder.or(
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.<String>get("name")),
                                pattern),
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.<String>get("description")),
                                pattern));

        return roleRepository.findAll(specification, pageable)
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
    public ImportResult importRoles(MultipartFile file) {
        check("ROLE_CREATE");
        ImportResult result = new ImportResult();
        List<RowError> errors = new ArrayList<>();

        if (file == null || file.isEmpty()) {
            errors.add(new RowError(0, "The uploaded file is empty"));
            return importFailure(errors);
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            errors.add(new RowError(0, "Only Excel .xlsx files are supported"));
            return importFailure(errors);
        }

        List<Map<String, String>> rows;
        try (InputStream inputStream = file.getInputStream()) {
            FileParser parser = parserFactory.getParser(filename);
            rows = parser.parse(inputStream);
        } catch (IOException | RuntimeException exception) {
            errors.add(new RowError(0, "Unable to read Excel file: " + exception.getMessage()));
            return importFailure(errors);
        }

        List<Role> rolesToSave = new ArrayList<>();
        Set<String> namesInFile = new HashSet<>();
        int rowNumber = 2;

        for (Map<String, String> row : rows) {
            if (row.values().stream().allMatch(value -> value == null || value.isBlank())) {
                rowNumber++;
                continue;
            }

            List<String> rowErrors = new ArrayList<>();
            String name = row.get("Name") == null ? null : row.get("Name").trim();
            String description = row.get("Description");
            String normalizedName = name == null ? "" : name.toLowerCase(Locale.ROOT);

            if (name == null || name.isBlank()) {
                rowErrors.add("Name is required");
            } else {
                if (name.length() > 100) {
                    rowErrors.add("Name must not exceed 100 characters");
                }
                if (!namesInFile.add(normalizedName)) {
                    rowErrors.add("Role name is duplicated in the file");
                }
                if (roleRepository.findByName(name).isPresent()) {
                    rowErrors.add("Role name already exists");
                }
            }

            if (description != null && description.length() > 1000) {
                rowErrors.add("Description must not exceed 1000 characters");
            }

            String activeValue = row.get("Is Active");
            Boolean isActive = activeValue == null || activeValue.isBlank()
                    ? true
                    : parseActiveStatus(activeValue, rowErrors);

            Set<Permission> permissions = new HashSet<>();
            String permissionsCell = row.get("Permissions");
            if (permissionsCell != null && !permissionsCell.isBlank()) {
                for (String permissionName : permissionsCell.split(",")) {
                    String normalizedPermissionName = permissionName.trim();
                    if (normalizedPermissionName.isEmpty()) {
                        continue;
                    }

                    Optional<Permission> permission =
                            permissionRepository.findByName(normalizedPermissionName);
                    if (permission.isPresent()) {
                        permissions.add(permission.get());
                    } else {
                        rowErrors.add("Permission does not exist: " + normalizedPermissionName);
                    }
                }
            }

            if (!rowErrors.isEmpty()) {
                errors.add(new RowError(rowNumber, String.join("; ", rowErrors)));
            } else {
                Role role = new Role();
                role.setName(name);
                role.setDescription(description);
                role.setIsSystem(false);
                role.setPermissions(permissions);
                role.setIsActive(isActive);
                rolesToSave.add(role);
            }

            rowNumber++;
        }

        if (rolesToSave.isEmpty() && errors.isEmpty()) {
            errors.add(new RowError(1, "The Excel file contains no role records"));
        }

        if (!errors.isEmpty()) {
            return importFailure(errors);
        }

        result.setSuccessCount(roleRepository.saveAll(rolesToSave).size());
        return result;
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
        if (isProtectedRole(role)) {
            throw new BadRequestException(
                    "System roles (ADMIN) cannot be deleted to prevent system lockout.");
        }

        if (userRepository.countByRolesId(role.getId()) > 0) {
            throw new BadRequestException(
                    "Roles assigned to users cannot be deleted.");
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
        return Boolean.TRUE.equals(role.getIsSystem())
                || (role.getName() != null
                && PROTECTED_ROLES.contains(role.getName().toUpperCase(Locale.ROOT)));
    }

    private Boolean parseActiveStatus(String value, List<String> errors) {
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "true", "active", "1", "1.0" -> true;
            case "false", "inactive", "0", "0.0" -> false;
            default -> {
                errors.add("Is Active must be Active/Inactive or true/false");
                yield true;
            }
        };
    }

    private ImportResult importFailure(List<RowError> errors) {
        ImportResult result = new ImportResult();
        result.setSuccessCount(0);
        result.setFailureCount(errors.size());
        result.setErrors(errors);
        return result;
    }
}
