package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * T1 — Bảo đảm permission của module điểm danh tồn tại và được gán đúng role.
 *
 * <p>Chạy sau {@code PermissionInitializer} (order 1) và {@code RoleDataInitializer} (order 2)
 * để ADMIN/TEACHER/STUDENT đã được tạo:</p>
 *
 * <ul>
 *     <li>ADMIN: toàn bộ {@code ATTENDANCE_*} + {@code ATTENDANCE_UNLOCK} + {@code ATTENDANCE_READ_SELF}</li>
 *     <li>TEACHER (Trainer được phân công): CREATE / READ / UPDATE</li>
 *     <li>STUDENT (Trainee): READ_SELF (SCR-70)</li>
 * </ul>
 *
 * <p>Idempotent: chạy lại nhiều lần không nhân đôi permission.</p>
 */
@Slf4j
@Component
@Order(3)
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AttendancePermissionInitializer implements CommandLineRunner {

    static final String RESOURCE = "ATTENDANCE";
    static final List<String> CRUD_ACTIONS = List.of("CREATE", "READ", "UPDATE", "DELETE");
    static final String UNLOCK_ACTION = "UNLOCK";
    static final String READ_SELF_ACTION = "READ_SELF";

    PermissionRepository permissionRepository;
    RoleRepository roleRepository;

    @Override
    @Transactional
    public void run(String... args) {
        Map<String, Permission> permissions = new LinkedHashMap<>();
        for (String action : CRUD_ACTIONS) {
            permissions.put(action, ensurePermission(action));
        }
        Permission unlock = ensurePermission(UNLOCK_ACTION);
        Permission readSelf = ensurePermission(READ_SELF_ACTION);

        grant("ADMIN", permissions.values());
        grant("ADMIN", List.of(unlock, readSelf));

        grant("TEACHER", List.of(
                permissions.get("CREATE"),
                permissions.get("READ"),
                permissions.get("UPDATE")));

        grant("STUDENT", List.of(readSelf));
    }

    private Permission ensurePermission(String action) {
        String name = RESOURCE + "_" + action;
        return permissionRepository.findByName(name).orElseGet(() -> permissionRepository.save(
                Permission.builder()
                        .name(name)
                        .resource(RESOURCE)
                        .action(action)
                        .description("Attendance " + action.toLowerCase().replace('_', ' ') + " permission")
                        .build()));
    }

    private void grant(String roleName, Collection<Permission> permissions) {
        roleRepository.findByName(roleName).ifPresentOrElse(role -> {
            List<Permission> missing = new ArrayList<>();
            for (Permission permission : permissions) {
                boolean present = role.getPermissions().stream()
                        .anyMatch(existing -> existing.getName().equals(permission.getName()));
                if (!present) {
                    missing.add(permission);
                }
            }
            if (missing.isEmpty()) {
                return;
            }
            role.getPermissions().addAll(missing);
            roleRepository.save(role);
            log.info("Granted attendance permissions {} to role {}", missing.stream()
                    .map(Permission::getName).toList(), roleName);
        }, () -> log.warn("Role {} not found — skip attendance permission grant.", roleName));
    }
}
