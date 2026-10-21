package com.example.starter_project_2025.system.rbac.permission;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;

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

    @GetMapping("/matrix")
    public ResponseEntity<List<PermissionMatrixItemDTO>> getPermissionMatrix() {
        requirePermission("PERMISSION_READ");
        List<PermissionMatrixItemDTO> result = permissionRepository.findAll().stream()
                .sorted(Comparator.comparing(Permission::getResource, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(Permission::getAction, String.CASE_INSENSITIVE_ORDER))
                .map(p -> new PermissionMatrixItemDTO(
                        p.getId(), p.getName(), p.getDescription(), p.getResource(), p.getAction()))
                .toList();
        return ResponseEntity.ok(result);
    }

    private void requirePermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities().stream()
                .noneMatch(authority -> permission.equals(authority.getAuthority()))) {
            throw new AccessDeniedException("Missing permission: " + permission);
        }
    }
}
