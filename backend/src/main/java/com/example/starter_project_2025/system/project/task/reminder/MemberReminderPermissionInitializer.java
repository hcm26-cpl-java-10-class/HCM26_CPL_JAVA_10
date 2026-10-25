package com.example.starter_project_2025.system.project.task.reminder;
import com.example.starter_project_2025.system.rbac.permission.*;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Component @Order(7) @RequiredArgsConstructor
public class MemberReminderPermissionInitializer implements CommandLineRunner{
    private final PermissionRepository permissions;
    private final RoleRepository roles;
    @Override @Transactional public void run(String... args){
        for(String action:List.of("READ","SEND")){
            String key="INACTIVE_MEMBER_"+action;
            var permission=permissions.findByName(key).orElseGet(()->permissions.save(Permission.builder().name(key)
                    .resource("INACTIVE_MEMBER").action(action).description("Monitor inactivity or queue reminders within managed team scope").build()));
            for(String name:List.of("ADMIN","SYSTEM_ADMIN","SUPER_ADMIN","TEACHER","MENTOR","TRAINER","TEAM_LEADER","STUDENT","TRAINEE"))
                roles.findByName(name).ifPresent(role->{role.getPermissions().add(permission);roles.save(role);});
            // Student authority is usable only when the current project membership is TEAM_LEADER.
        }
    }
}
