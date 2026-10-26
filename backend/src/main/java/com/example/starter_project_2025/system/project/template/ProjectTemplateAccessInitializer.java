package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(4)
@RequiredArgsConstructor
public class ProjectTemplateAccessInitializer implements CommandLineRunner {
    private final PermissionRepository permissions;
    private final RoleRepository roles;

    @Override
    @Transactional
    public void run(String... args) {
        var templatePermissions = new ArrayList<Permission>();
        for (String action : List.of("READ", "CREATE", "UPDATE")) {
            String name = "PROJECT_TEMPLATE_" + action;
            Permission permission = permissions.findByName(name).orElseGet(() -> permissions.save(
                    Permission.builder().name(name).resource("PROJECT_TEMPLATE").action(action).build()));
            permission.setIsActive(true);
            templatePermissions.add(permissions.save(permission));
        }
        for (String name : List.of("ADMIN", "PROGRAM_MANAGER")) {
            roles.findByName(name).ifPresent(role -> {
                role.getPermissions().addAll(templatePermissions);
                roles.save(role);
            });
        }
    }
}
