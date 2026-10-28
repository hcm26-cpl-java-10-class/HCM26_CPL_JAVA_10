package com.example.starter_project_2025.system.project.alert;
import com.example.starter_project_2025.system.rbac.permission.*;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.List;
@Component @Order(8) @RequiredArgsConstructor
public class ProjectAlertPermissionInitializer implements CommandLineRunner {
    private final PermissionRepository permissions;
    private final RoleRepository roles;
    @Override @Transactional public void run(String... args) {
        var alertPermissions=new ArrayList<Permission>();
        for(String key:List.of("PROJECT_ALERT_READ","SPRINT_BACKLOG_READ","MILESTONE_READ",
                "INACTIVE_MEMBER_READ","TASK_ALERT_SEND","MILESTONE_ALERT_SEND","INACTIVE_MEMBER_SEND")) {
            int split=key.lastIndexOf('_');
            alertPermissions.add(permissions.findByName(key).orElseGet(()->permissions.save(Permission.builder()
                    .name(key).resource(key.substring(0,split)).action(key.substring(split+1))
                    .description("Monitor or queue alerts within managed class/team scope").build())));
        }
        for(String name:List.of("ADMIN","ADMINISTRATOR","SYSTEM_ADMIN","SUPER_ADMIN","TEACHER","MENTOR","TRAINER","TEAM_LEADER","STUDENT","TRAINEE"))
            roles.findByName(name).ifPresent(role->{role.getPermissions().addAll(alertPermissions);roles.save(role);});
        // STUDENT still needs an active PM/leader membership in the selected team.
    }
}
