package com.example.starter_project_2025.system.project.milestone.risk;
import com.example.starter_project_2025.system.rbac.permission.*;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
@Component @Order(6) @RequiredArgsConstructor
public class MilestoneRiskPermissionInitializer implements CommandLineRunner {
    private final PermissionRepository permissions;
    private final RoleRepository roles;
    @Override @Transactional public void run(String... args) {
        for (String key : List.of("MILESTONE_RISK_READ", "MILESTONE_ALERT_SEND")) {
            var permission = permissions.findByName(key).orElseGet(() -> permissions.save(
                    Permission.builder().name(key).resource("MILESTONE").action(key.equals("MILESTONE_RISK_READ") ? "RISK_READ" : "ALERT_SEND")
                            .description("Read milestone risk or queue alerts within the assigned project scope").build()));
            for (String roleName : List.of("ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "TEACHER", "MENTOR", "TRAINER", "STUDENT", "TRAINEE", "TEAM_LEADER"))
                roles.findByName(roleName).ifPresent(role -> {
                    // Student authority is only usable by a current project TEAM_LEADER.
                    // Ordinary students are rejected by the authoritative project scope check.
                    role.getPermissions().add(permission); roles.save(role);
                });
        }
    }
}
