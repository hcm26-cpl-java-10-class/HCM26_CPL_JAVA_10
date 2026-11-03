package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Grants the learning-resource permissions to the existing roles.
 * <p>
 * {@code ADMIN} already receives every permission during the regular RBAC
 * bootstrap. {@code TEACHER} manages both template resources and project
 * resources; {@code STUDENT} gets read access to project resources only.
 * <p>
 * Runs after {@code PermissionInitializer} (@Order(1)), which generates the
 * permissions from the entity annotations, and after
 * {@code RoleDataInitializer} (@Order(2)), which resets the role permission
 * sets.
 */
@Slf4j
@Order(4)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ResourceAccessInitializer implements CommandLineRunner {

    private static final String TEACHER_ROLE = "TEACHER";
    private static final String STUDENT_ROLE = "STUDENT";

    private static final List<String> RESOURCE_PERMISSIONS = List.of(
            "PROJECT_RESOURCE_CREATE",
            "PROJECT_RESOURCE_READ",
            "PROJECT_RESOURCE_UPDATE",
            "PROJECT_RESOURCE_DELETE",
            "PROJECT_RESOURCE_FILE_CREATE",
            "PROJECT_RESOURCE_FILE_READ",
            "PROJECT_RESOURCE_FILE_UPDATE",
            "PROJECT_RESOURCE_FILE_DELETE"
    );

    private static final List<String> TEMPLATE_RESOURCE_PERMISSIONS = List.of(
            "PROJECT_TEMPLATE_RESOURCE_CREATE",
            "PROJECT_TEMPLATE_RESOURCE_READ",
            "PROJECT_TEMPLATE_RESOURCE_UPDATE",
            "PROJECT_TEMPLATE_RESOURCE_DELETE",
            "PROJECT_TEMPLATE_RESOURCE_FILE_CREATE",
            "PROJECT_TEMPLATE_RESOURCE_FILE_READ",
            "PROJECT_TEMPLATE_RESOURCE_FILE_UPDATE",
            "PROJECT_TEMPLATE_RESOURCE_FILE_DELETE"
    );

    private static final List<String> STUDENT_PERMISSIONS = List.of(
            "PROJECT_RESOURCE_READ",
            "PROJECT_RESOURCE_FILE_READ"
    );

    RoleRepository roleRepository;
    PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(String... args) {

        List<String> teacherPermissions = new java.util.ArrayList<>(RESOURCE_PERMISSIONS);
        teacherPermissions.addAll(TEMPLATE_RESOURCE_PERMISSIONS);

        grant(TEACHER_ROLE, teacherPermissions);
        grant(STUDENT_ROLE, STUDENT_PERMISSIONS);
    }

    private void grant(String roleName, List<String> permissionNames) {

        Role role = roleRepository.findByName(roleName).orElse(null);

        if (role == null) {
            log.warn("Role {} not found, skipping resource permission grant", roleName);
            return;
        }

        Set<Permission> permissions = new HashSet<>(
                role.getPermissions() == null ? Set.of() : role.getPermissions()
        );

        int before = permissions.size();

        for (String permissionName : permissionNames) {
            permissionRepository.findByName(permissionName).ifPresent(permissions::add);
        }

        if (permissions.size() == before) {
            return;
        }

        role.setPermissions(permissions);
        roleRepository.save(role);

        log.info("Granted learning resource permissions to role {}: {}", roleName, permissionNames);
    }
}
