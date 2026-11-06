package com.example.starter_project_2025.system.project.sprint_backlog;

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
 * Grants the Sprint Backlog permissions to the {@code STUDENT} role so the
 * Team Leader / Member persona can manage sprint backlog items.
 * {@code ADMIN} already receives every permission during the regular RBAC
 * bootstrap.
 * <p>
 * Runs after {@code PermissionInitializer} (@Order(1)) so the
 * SPRINT_BACKLOG_* permissions exist, and after {@code RoleDataInitializer}
 * (@Order(2)) so the STUDENT role exists.
 */
@Slf4j
@Order(6)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintBacklogAccessInitializer implements CommandLineRunner {

    private static final String STUDENT_ROLE = "STUDENT";

    private static final List<String> SPRINT_BACKLOG_PERMISSIONS = List.of(
            "SPRINT_BACKLOG_CREATE",
            "SPRINT_BACKLOG_READ",
            "SPRINT_BACKLOG_UPDATE",
            "SPRINT_BACKLOG_DELETE"
    );

    RoleRepository roleRepository;
    PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(String... args) {

        Role studentRole = roleRepository.findByName(STUDENT_ROLE).orElse(null);

        if (studentRole == null) {
            log.warn("Role {} not found, skipping sprint backlog permission grant", STUDENT_ROLE);
            return;
        }

        Set<Permission> permissions = new HashSet<>(
                studentRole.getPermissions() == null ? Set.of() : studentRole.getPermissions()
        );

        int before = permissions.size();

        for (String permissionName : SPRINT_BACKLOG_PERMISSIONS) {
            permissionRepository.findByName(permissionName).ifPresent(permissions::add);
        }

        if (permissions.size() == before) {
            return;
        }

        studentRole.setPermissions(permissions);
        roleRepository.save(studentRole);

        log.info("Granted sprint backlog permissions to role {}: {}",
                STUDENT_ROLE, SPRINT_BACKLOG_PERMISSIONS);
    }
}
