package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.List;

@Component
@Order(8)
@RequiredArgsConstructor
public class ProjectReportPermissionInitializer implements CommandLineRunner {
    private final PermissionRepository permissions;
    private final RoleRepository roles;
    @Override @Transactional public void run(String... args) {
        var granted = new ArrayList<Permission>();
        for (String action : List.of("READ","EXPORT")) {
            String name = "PROJECT_REPORT_" + action;
            granted.add(permissions.findByName(name).orElseGet(() -> permissions.save(Permission.builder()
                    .name(name).resource("PROJECT_REPORT").action(action).description("View or export scoped project reports").build())));
        }
        for (String roleName : List.of("ADMIN","ADMINISTRATOR","SYSTEM_ADMIN","SUPER_ADMIN","SCHOOL_ADMIN",
                "PROGRAM_MANAGER","CLASS_ADMIN","MENTOR","TEACHER","TRAINER"))
            roles.findByName(roleName).ifPresent(role -> { role.getPermissions().addAll(granted); roles.save(role); });
    }
}
