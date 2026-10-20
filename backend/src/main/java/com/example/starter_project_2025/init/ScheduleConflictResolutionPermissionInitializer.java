package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Order(1)
@RequiredArgsConstructor
public class ScheduleConflictResolutionPermissionInitializer implements CommandLineRunner {

    private static final String RESOURCE = "SCHEDULE_CONFLICT_RESOLUTION";
    private static final List<String> ACTIONS = List.of(
            "READ",
            "REQUEST",
            "APPROVE",
            "REVOKE"
    );

    private final PermissionRepository permissionRepository;

    @Override
    public void run(String... args) {
        for (String action : ACTIONS) {
            String name = RESOURCE + "_" + action;
            if (permissionRepository.existsByName(name)) {
                continue;
            }
            permissionRepository.save(Permission.builder()
                    .name(name)
                    .resource(RESOURCE)
                    .action(action)
                    .description("Schedule conflict resolution " + action.toLowerCase() + " permission")
                    .build());
        }
    }
}
