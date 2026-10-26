package com.example.starter_project_2025.init;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Order(2)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleDataInitializer implements CommandLineRunner {

    private static final String ADMIN_ROLE = "ADMIN";
    private static final String STUDENT_ROLE = "STUDENT";
    private static final String TEACHER_ROLE = "TEACHER";

    RoleRepository roleRepository;
    PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        ensurePermission("PEO", "TEAM_ALLOCATE");
        ensurePermission("EXAM", "TAKE");
        List<Permission> allPermissions = permissionRepository.findAll();

        upsertRole(
                ADMIN_ROLE,
                "Administrator with full system access",
                allPermissions
        );

        upsertRole(
                STUDENT_ROLE,
                "Student with course access",
                findPermissions(
                        "MENU_READ",
                        "BOOK_READ",
                        "COURSE_READ",
                        "ENROLLMENT_READ",
                        "ENROLLMENT_CREATE",
                        "LESSON_READ",
                        "EXAM_TAKE",
                        "WORKSPACE_READ", "WORKSPACE_MEMBER_READ",
                        "MILESTONE_READ", "SPRINT_READ", "TASK_WRITE", "ARTIFACT_READ", "ARTIFACT_SUBMIT",
                        "FEEDBACK_READ", "WORKSPACE_ACTIVITY_READ"
                )
        );

        upsertRole(
                TEACHER_ROLE,
                "Teacher with learning resource management permissions",
                findPermissions(
                        "MENU_READ",
                        "BOOK_CREATE", "BOOK_READ", "BOOK_UPDATE", "BOOK_DELETE",
                        "COURSE_CREATE", "COURSE_READ", "COURSE_UPDATE", "COURSE_DELETE",
                        "LESSON_CREATE", "LESSON_READ", "LESSON_UPDATE", "LESSON_DELETE",
                        "EXAM_CREATE", "EXAM_READ", "EXAM_UPDATE", "EXAM_DELETE",
                        "QUESTION_CREATE", "QUESTION_READ", "QUESTION_UPDATE", "QUESTION_DELETE",
                        "INVITATION_CREATE", "INVITATION_READ", "INVITATION_UPDATE", "INVITATION_DELETE",
                        "WORKSPACE_READ", "WORKSPACE_CREATE", "WORKSPACE_MEMBER_READ", "TEAM_READ", "TEAM_UPDATE",
                        "MILESTONE_READ", "MILESTONE_WRITE", "SPRINT_READ", "SPRINT_WRITE",
                        "ARTIFACT_READ", "ARTIFACT_WRITE", "ARTIFACT_REVIEW", "FEEDBACK_READ", "FEEDBACK_WRITE",
                        "WORKSPACE_ACTIVITY_READ"
                )
        );

        // Grant an existing PM role; do not create extra roles/accounts or expand data scope.
        roleRepository.findByName("PM").ifPresent(pm -> {
            pm.getPermissions().addAll(findPermissions("WORKSPACE_READ", "WORKSPACE_MEMBER_READ",
                    "MILESTONE_READ", "MILESTONE_WRITE", "SPRINT_READ", "SPRINT_WRITE",
                    "ARTIFACT_READ", "ARTIFACT_WRITE", "ARTIFACT_SUBMIT", "ARTIFACT_REVIEW",
                    "FEEDBACK_READ", "FEEDBACK_WRITE", "WORKSPACE_ACTIVITY_READ"));
            roleRepository.save(pm);
        });
        ensureAllocationPermissionForRole(
                "PROGRAM_MANAGER", "Program manager with team allocation access");
        ensureAllocationPermissionForRole(
                "MENTOR", "Mentor with team allocation access");
        ensureAllocationPermissionForRole(
                "CLASS_ADMIN", "Class administrator with team allocation access");

        log.info("Ensured roles and permission mappings: ADMIN, STUDENT, TEACHER.");
    }

    private void upsertRole(String roleName, String description, Collection<Permission> permissions) {
        Role role = roleRepository.findByName(roleName).orElseGet(Role::new);

        role.setName(roleName);
        role.setDescription(description);
        role.setIsActive(true);
        role.setPermissions(new HashSet<>(permissions));

        roleRepository.save(role);
    }

    private List<Permission> findPermissions(String... permissionNames) {
        List<Permission> permissions = new ArrayList<>();

        for (String permissionName : permissionNames) {
            permissionRepository.findByName(permissionName).ifPresent(permissions::add);
        }

        return permissions;
    }

    private void ensurePermission(String resource, String action) {
        String name = resource + "_" + action;
        if (permissionRepository.existsByName(name)) return;
        permissionRepository.save(Permission.builder()
                .name(name).resource(resource).action(action)
                .description("Manually defined permission").build());
    }
    private void ensureAllocationPermissionForRole(String roleName, String description) {
        Permission allocationPermission = permissionRepository.findByName("PEO_TEAM_ALLOCATE")
                .orElseThrow(() -> new IllegalStateException(
                        "PEO_TEAM_ALLOCATE permission was not initialized"));
        Permission classReadPermission = permissionRepository.findByName("TRAINING_CLASS_READ")
                .orElseThrow(() -> new IllegalStateException(
                        "TRAINING_CLASS_READ permission was not initialized"));
        Role role = roleRepository.findByName(roleName).orElseGet(() -> {
            Role newRole = new Role();
            newRole.setName(roleName);
            newRole.setDescription(description);
            newRole.setIsActive(true);
            return newRole;
        });
        role.getPermissions().add(allocationPermission);
        role.getPermissions().add(classReadPermission);
        roleRepository.save(role);
    }
}
