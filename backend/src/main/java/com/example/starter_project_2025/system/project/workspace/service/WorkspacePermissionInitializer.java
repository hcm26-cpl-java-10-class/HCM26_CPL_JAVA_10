package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
@RequiredArgsConstructor
public class WorkspacePermissionInitializer implements CommandLineRunner {
    private final PermissionRepository permissions;
    @Override public void run(String... args) {
        for (String name : java.util.List.of("MILESTONE_READ", "MILESTONE_WRITE", "SPRINT_READ", "SPRINT_WRITE",
                "TASK_WRITE", "ARTIFACT_READ", "ARTIFACT_WRITE", "ARTIFACT_SUBMIT", "ARTIFACT_REVIEW",
                "FEEDBACK_READ", "FEEDBACK_WRITE", "WORKSPACE_ACTIVITY_READ")) {
            if (!this.permissions.existsByName(name)) {
                int split = name.lastIndexOf('_');
                this.permissions.save(Permission.builder().name(name).resource(name.substring(0, split))
                        .action(name.substring(split + 1)).description("US-PRJ-001-03 section permission").build());
            }
        }
        ensure("VIEW_PROJECT_WORKSPACE", "READ");
        ensure("CREATE_PROJECT_WORKSPACE", "CREATE");
        if (!permissions.existsByName("WORKSPACE_MEMBER_READ")) {
            permissions.save(Permission.builder().name("WORKSPACE_MEMBER_READ")
                    .resource("WORKSPACE_MEMBER").action("READ")
                    .description("US-PRJ-001-02: view workspace members").build());
        }
    }
    private void ensure(String name, String action) {
        if (!permissions.existsByName(name)) permissions.save(Permission.builder().name(name)
                .resource("WORKSPACE").action(action).description("US-PRJ-001-01 workspace permission").build());
    }
}
