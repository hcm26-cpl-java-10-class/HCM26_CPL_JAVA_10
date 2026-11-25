package com.example.starter_project_2025.system.git_integration.config;

import com.example.starter_project_2025.system.git_integration.service.GitIntegrationAccessService;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Seeds the Git Integration permissions. Runs before RoleDataInitializer
 * (Order 2), which grants every permission to ADMIN. The PM role, when it
 * exists, also receives both permissions.
 */
@Component
@Order(1)
@RequiredArgsConstructor
public class GitIntegrationPermissionInitializer implements CommandLineRunner {

    private static final String PROJECT_MANAGER_ROLE = "PM";

    private final PermissionRepository permissions;
    private final RoleRepository roles;

    @Override
    @Transactional
    public void run(String... args) {
        ensure(GitIntegrationAccessService.PERMISSION_READ, "READ", "US-GIT-001: view Git Integration status");
        ensure(GitIntegrationAccessService.PERMISSION_MANAGE, "MANAGE", "US-GIT-001: connect GitHub App");

        List<Permission> granted = List.of(
                permissions.findByName(GitIntegrationAccessService.PERMISSION_READ).orElseThrow(),
                permissions.findByName(GitIntegrationAccessService.PERMISSION_MANAGE).orElseThrow());
        roles.findByName(PROJECT_MANAGER_ROLE).ifPresent(pm -> {
            if (pm.getPermissions().addAll(granted)) {
                roles.save(pm);
            }
        });
    }

    private void ensure(String name, String action, String description) {
        if (!permissions.existsByName(name)) {
            permissions.save(Permission.builder()
                    .name(name).resource("GIT_INTEGRATION").action(action).description(description).build());
        }
    }
}
