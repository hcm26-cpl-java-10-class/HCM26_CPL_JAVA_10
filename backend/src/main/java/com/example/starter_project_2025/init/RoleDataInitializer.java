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
        // The marker permission makes this mapping migration run once.
        boolean migrateAccess = !permissionRepository.existsByName("LEARNING_SELF_READ");
        ensurePermission("ADMIN", "ACCESS");
        ensurePermission("LEARNER", "ACCESS");
        ensurePermission("USER_LEARNING", "READ");
        ensurePermission("LEARNING_SELF", "READ");
        List<Permission> allPermissions = permissionRepository.findAll();

        upsertRole(
                ADMIN_ROLE,
                "Administrator with full system access",
                allPermissions.stream().filter(p -> !isPersonalLearning(p.getName())).toList()
        );

        upsertRole(
                STUDENT_ROLE,
                "Student with read-only access to books and courses",
                findPermissions(
                        "LEARNER_ACCESS", "LEARNING_SELF_READ",
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
                        "ADMIN_ACCESS",
                        "MENU_READ",
                        "BOOK_CREATE", "BOOK_READ", "BOOK_UPDATE", "BOOK_DELETE",
                        "COURSE_CREATE", "COURSE_READ", "COURSE_UPDATE", "COURSE_DELETE",
                        "LESSON_CREATE", "LESSON_READ", "LESSON_UPDATE", "LESSON_DELETE",
                        "EXAM_CREATE", "EXAM_READ", "EXAM_UPDATE", "EXAM_DELETE",
                        "QUESTION_CREATE", "QUESTION_READ", "QUESTION_UPDATE", "QUESTION_DELETE",
                        "INVITATION_CREATE", "INVITATION_READ", "INVITATION_UPDATE", "INVITATION_DELETE"
                )
        );

        if (migrateAccess) {
            for (Role role : roleRepository.findAll()) {
                var permissions = new HashSet<>(role.getPermissions());
                if (ADMIN_ROLE.equals(role.getName())) {
                    permissions.removeIf(p -> isPersonalLearning(p.getName()));
                    permissions.addAll(findPermissions("ADMIN_ACCESS", "USER_LEARNING_READ"));
                } else if (STUDENT_ROLE.equals(role.getName())) {
                    permissions.addAll(findPermissions("LEARNER_ACCESS", "LEARNING_SELF_READ"));
                } else {
                    // Preserve custom roles by translating their existing capabilities.
                    if (TEACHER_ROLE.equals(role.getName()) || permissions.stream().anyMatch(p ->
                            p.getName().equals("USER_READ") || (!p.getName().startsWith("ENROLLMENT_")
                            && (p.getName().endsWith("_CREATE") || p.getName().endsWith("_UPDATE")
                            || p.getName().endsWith("_DELETE"))))) {
                        permissions.addAll(findPermissions("ADMIN_ACCESS"));
                    }
                    if (permissions.stream().anyMatch(p -> p.getName().equals("ENROLLMENT_READ"))) {
                        permissions.addAll(findPermissions("LEARNER_ACCESS", "LEARNING_SELF_READ"));
                    }
                }
                role.setPermissions(permissions);
                roleRepository.save(role);
            }
        }
        log.info("Ensured roles and permission mappings: ADMIN, STUDENT, TEACHER.");
    }

    private void upsertRole(String roleName, String description, Collection<Permission> permissions) {
        // Existing assignments and customized mappings must survive application restarts.
        if (roleRepository.findByName(roleName).isPresent()) return;
        Role role = new Role();

        role.setName(roleName);
        role.setDescription(description);
        role.setIsSystem(true);
        role.setIsActive(true);
        role.setPermissions(new HashSet<>(permissions));

        roleRepository.save(role);
    }

    private boolean isPersonalLearning(String name) {
        return name.equals("LEARNER_ACCESS") || name.equals("LEARNING_SELF_READ")
                || name.startsWith("ENROLLMENT_") || name.equals("EXAM_TAKE");
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