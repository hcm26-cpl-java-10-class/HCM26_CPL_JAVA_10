package com.example.starter_project_2025.system.project.task.alert;
import com.example.starter_project_2025.system.rbac.permission.*;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Component @Order(5) @RequiredArgsConstructor
public class TaskAlertPermissionInitializer implements CommandLineRunner {
    private final PermissionRepository permissions;
    private final RoleRepository roles;
    @Override @Transactional public void run(String... args) {
        var permission = permissions.findByName("TASK_ALERT_SEND").orElseGet(() -> permissions.save(
                Permission.builder().name("TASK_ALERT_SEND").resource("TASK_ALERT").action("SEND")
                .description("Queue overdue task alerts within the assigned project/team scope").build()));
        for (String name : List.of("ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "TEACHER", "MENTOR", "TEAM_LEADER", "STUDENT"))
            roles.findByName(name).ifPresent(role -> {
                // A Student needs this authority to act as a project TEAM_LEADER.
                // The service still checks the actual team role for every selected task.
                role.getPermissions().add(permission);
                permissions.findByName("TASK_READ").ifPresent(role.getPermissions()::add);
                roles.save(role);
            });
    }
}
