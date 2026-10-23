package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@Order(4)
@RequiredArgsConstructor
public class TaskAccessInitializer implements CommandLineRunner {
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        for (String roleName : List.of("STUDENT", "TEACHER")) {
            roleRepository.findByName(roleName).ifPresent(role -> {
                for (String name : List.of("TASK_CREATE", "TASK_READ", "TASK_UPDATE")) {
                    permissionRepository.findByName(name).ifPresent(role.getPermissions()::add);
                }
                roleRepository.save(role);
            });
        }
    }
}
