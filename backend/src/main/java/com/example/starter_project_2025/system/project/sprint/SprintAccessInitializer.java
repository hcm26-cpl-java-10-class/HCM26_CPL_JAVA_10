package com.example.starter_project_2025.system.project.sprint;

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
 * Grants the sprint use case permissions to the {@code STUDENT} role so the
 * Team Leader / Member persona of UFR-PRJ-003-01 can create and manage
 * sprints. {@code ADMIN} already receives every permission during the regular
 * RBAC bootstrap.
 * <p>
 * Runs after {@code RoleDataInitializer} (@Order(2)) so the STUDENT role exists
 * and after {@code PermissionInitializer} (@Order(1)) so the SPRINT_* /
 * PROJECT_* permissions have been generated from the entity annotations.
 */
@Slf4j
@Order(4)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintAccessInitializer implements CommandLineRunner {

    private static final String STUDENT_ROLE = "STUDENT";

    private static final List<String> SPRINT_PERMISSIONS = List.of(
            "PROJECT_READ",
            "SPRINT_CREATE",
            "SPRINT_READ",
            "SPRINT_UPDATE",
            "SPRINT_DELETE"
    );

    RoleRepository roleRepository;
    PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(String... args) {

        Role studentRole = roleRepository.findByName(STUDENT_ROLE).orElse(null);

        if (studentRole == null) {
            log.warn("Role {} not found, skipping sprint permission grant", STUDENT_ROLE);
            return;
        }

        Set<Permission> permissions = new HashSet<>(
                studentRole.getPermissions() == null ? Set.of() : studentRole.getPermissions()
        );

        int before = permissions.size();

        for (String permissionName : SPRINT_PERMISSIONS) {
            permissionRepository.findByName(permissionName).ifPresent(permissions::add);
        }

        if (permissions.size() == before) {
            return;
        }

        studentRole.setPermissions(permissions);
        roleRepository.save(studentRole);

        log.info("Granted sprint permissions to role {}: {}", STUDENT_ROLE, SPRINT_PERMISSIONS);
    }
}
