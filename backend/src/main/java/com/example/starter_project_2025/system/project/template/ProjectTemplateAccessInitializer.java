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
        for (String action : List.of("READ", "CREATE", "UPDATE", "ACTIVATE")) {
            templatePermissions.add(permission(action));
        }
        for (String name : List.of("ADMIN", "PROGRAM_MANAGER")) {
            roles.findByName(name).ifPresent(role -> {
                role.getPermissions().addAll(templatePermissions);
                roles.save(role);
            });
        }
        roles.findByName("PROGRAM_MANAGER").ifPresent(role -> {
            permissions.findByName("MENU_READ").ifPresent(permission -> role.getPermissions().add(permission));
            roles.save(role);
        });
    }

    private Permission permission(String action) {
        String name = "PROJECT_TEMPLATE_" + action;
        Permission permission = permissions.findByName(name).orElseGet(() ->
                Permission.builder().name(name).resource("PROJECT_TEMPLATE").action(action).build());
        permission.setIsActive(true);
        return permissions.save(permission);
    }
}
