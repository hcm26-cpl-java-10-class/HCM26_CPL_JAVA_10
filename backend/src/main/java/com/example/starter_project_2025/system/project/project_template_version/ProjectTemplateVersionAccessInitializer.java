package com.example.starter_project_2025.system.project.project_template_version;

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
 * Grants the project template version permissions to the roles that own the
 * version chain: {@code STUDENT} (version workspace, mirroring
 * {@code SprintAccessInitializer}) and {@code PROGRAM_MANAGER} (US-07 persona -
 * templates and their versions are managed from the Project Template module).
 * {@code ADMIN} already receives every permission during the regular RBAC
 * bootstrap.
 * <p>
 * Runs after {@code RoleDataInitializer} (@Order(2)) so the roles exist and
 * after {@code PermissionInitializer} (@Order(1)) so the
 * PROJECT_TEMPLATE_VERSION_* permissions have been generated from the entity
 * annotations.
 */
@Slf4j
@Order(6)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectTemplateVersionAccessInitializer implements CommandLineRunner {

    private static final List<String> SNAPSHOT_ROLES = List.of("STUDENT", "PROGRAM_MANAGER");

    private static final List<String> SNAPSHOT_PERMISSIONS = List.of(
            "PROJECT_TEMPLATE_VERSION_CREATE",
            "PROJECT_TEMPLATE_VERSION_READ",
            "PROJECT_TEMPLATE_VERSION_UPDATE",
            "PROJECT_TEMPLATE_VERSION_DELETE"
    );

    RoleRepository roleRepository;
    PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(String... args) {

        for (String roleName : SNAPSHOT_ROLES) {

            Role role = roleRepository.findByName(roleName).orElse(null);

            if (role == null) {
                log.warn("Role {} not found, skipping project template version permission grant", roleName);
                continue;
            }

            Set<Permission> permissions = new HashSet<>(
                    role.getPermissions() == null ? Set.of() : role.getPermissions()
            );

            int before = permissions.size();

            for (String permissionName : SNAPSHOT_PERMISSIONS) {
                permissionRepository.findByName(permissionName).ifPresent(permissions::add);
            }

            if (permissions.size() == before) {
                continue;
            }

            role.setPermissions(permissions);
            roleRepository.save(role);

            log.info("Granted project template version permissions to role {}: {}",
                    roleName, SNAPSHOT_PERMISSIONS);
        }
    }
}
