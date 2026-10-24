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
        ensurePermission("EXAM", "TAKE");
        List<Permission> allPermissions = permissionRepository.findAll();

        upsertRole(
                ADMIN_ROLE,
                "Administrator with full system access",
                allPermissions
        );

        upsertRole(
                STUDENT_ROLE,
                "Student with read-only access to books and courses",
                findPermissions(
                        "MENU_READ",
                        "BOOK_READ",
                        "COURSE_READ",
                        "ENROLLMENT_READ",
                        "ENROLLMENT_CREATE",
                        "LESSON_READ",
                        "EXAM_TAKE"
                )
        );

        upsertRole(
                TEACHER_ROLE,
                "Teacher with book, course and exam management permissions",
                findPermissions(
                        "MENU_READ",
                        "BOOK_CREATE", "BOOK_READ", "BOOK_UPDATE", "BOOK_DELETE",
                        "COURSE_CREATE", "COURSE_READ", "COURSE_UPDATE", "COURSE_DELETE",
                        "LESSON_CREATE", "LESSON_READ", "LESSON_UPDATE", "LESSON_DELETE",
                        "EXAM_CREATE", "EXAM_READ", "EXAM_UPDATE", "EXAM_DELETE",
                        "QUESTION_CREATE", "QUESTION_READ", "QUESTION_UPDATE", "QUESTION_DELETE",
                        "INVITATION_CREATE", "INVITATION_READ", "INVITATION_UPDATE", "INVITATION_DELETE",
                        "MILESTONE_CREATE", "MILESTONE_READ",
                        "RUBRIC_CREATE", "RUBRIC_READ", "RUBRIC_UPDATE", "RUBRIC_DELETE"
                )
        );

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
}
