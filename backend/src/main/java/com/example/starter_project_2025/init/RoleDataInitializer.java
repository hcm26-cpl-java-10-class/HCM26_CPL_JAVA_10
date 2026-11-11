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
        ensurePermission("COURSE_REPORT", "READ");
        ensurePermission("STUDENT_ANALYTICS", "READ");
        ensurePermission("PEO", "TEAM_ALLOCATE");
        ensurePermission("EXAM", "TAKE");
        ensurePermission("ARTIFACT", "DRAFT_WRITE");
        ensurePermission("COURSE_REPORT", "READ");
        ensurePermission("STUDENT_SCORE", "RELEASE");
        ensurePermission("STUDENT_SCORE", "VIEW_OWN");
        ensurePermission("SCORE_APPEAL", "CREATE");
        ensurePermission("SCORE_APPEAL", "VIEW_OWN");
        ensurePermission("SCORE_APPEAL", "READ");
        ensurePermission("SCORE_APPEAL", "REVIEW");
        List<Permission> allPermissions = permissionRepository.findAll();

        upsertRole(ADMIN_ROLE, "Administrator with full system access", permissionRepository.findAll());
        upsertRole(
                STUDENT_ROLE,
                "Student with access to books, courses and exams",
                findPermissions(
                        "MENU_READ",
                        "BOOK_READ",
                        "COURSE_READ",
                        "ENROLLMENT_READ",
                        "ENROLLMENT_CREATE",
                        "ENROLLMENT_DELETE",
                        "LESSON_READ",
                        "LESSON_PROGRESS_READ",
                        "LESSON_PROGRESS_UPDATE",
                        "CERTIFICATE_READ",
                        "LESSON_QUESTION_READ",
                        "LESSON_QUESTION_CREATE",
                        "LESSON_QUESTION_UPDATE",
                        "LESSON_QUESTION_DELETE",
                        "LESSON_REPORT_CREATE",
                        "EXAM_READ",
                        "EXAM_TAKE",
                        "INVITATION_READ",
                        "STUDENT_SCORE_VIEW_OWN",
                        "SCORE_APPEAL_CREATE",
                        "SCORE_APPEAL_VIEW_OWN",
                        "WORKSPACE_READ", "WORKSPACE_MEMBER_READ",
                        "MILESTONE_READ", "SPRINT_READ", "TASK_WRITE", "ARTIFACT_READ", "ARTIFACT_SUBMIT",
                        "ARTIFACT_DRAFT_WRITE",
                        "FEEDBACK_READ", "WORKSPACE_ACTIVITY_READ",
                        "PROGRAM_READ",
                        "SUBJECT_READ",
                        "SESSION_READ"
                )
        );
        upsertRole(
                TEACHER_ROLE,
                "Teacher with book, course, section, syllabus, training and exam management permissions",
                findPermissions(
                        "MENU_READ",
                        "BOOK_CREATE",
                        "BOOK_READ",
                        "BOOK_UPDATE",
                        "BOOK_DELETE",
                        "EXAM_CREATE",
                        "EXAM_READ",
                        "EXAM_UPDATE",
                        "EXAM_DELETE",
                        "QUESTION_CREATE",
                        "QUESTION_READ",
                        "QUESTION_UPDATE",
                        "QUESTION_DELETE",
                        "INVITATION_CREATE",
                        "INVITATION_READ",
                        "INVITATION_UPDATE",
                        "INVITATION_DELETE",
                        "SCORE_APPEAL_READ",
                        "SCORE_APPEAL_REVIEW",
                        "USER_READ",
                        "DEPARTMENT_READ",
                        "DEPARTMENT_UPDATE",
                        "DEPARTMENT_DELETE",
                        "DEPARTMENT_CREATE",
                        "COURSE_CREATE",
                        "COURSE_READ",
                        "COURSE_UPDATE",
                        "COURSE_DELETE",
                        "LESSON_CREATE",
                        "LESSON_READ",
                        "LESSON_UPDATE",
                        "LESSON_DELETE",
                        "CATEGORY_CREATE", "CATEGORY_READ", "CATEGORY_UPDATE", "CATEGORY_DELETE",
                        "COURSE_REPORT_READ",
                        "STUDENT_ANALYTICS_READ",
                        "SECTION_CREATE", "SECTION_READ", "SECTION_UPDATE", "SECTION_DELETE",
                        "SYLLABUS_CREATE", "SYLLABUS_READ", "SYLLABUS_UPDATE", "SYLLABUS_DELETE",
                        "LESSON_QUESTION_READ", "LESSON_QUESTION_DELETE",
                        "LESSON_ANSWER_CREATE", "LESSON_ANSWER_READ",
                        "LESSON_ANSWER_UPDATE", "LESSON_ANSWER_DELETE",
                        "LESSON_REPORT_READ", "LESSON_REPORT_UPDATE",
                        "EXAM_TAKE",
                        "WORKSPACE_READ", "WORKSPACE_CREATE", "WORKSPACE_MEMBER_READ", "TEAM_READ", "TEAM_UPDATE",
                        "MILESTONE_READ", "MILESTONE_WRITE", "SPRINT_READ", "SPRINT_WRITE",
                        "ARTIFACT_READ", "ARTIFACT_WRITE", "ARTIFACT_REVIEW", "FEEDBACK_READ", "FEEDBACK_WRITE",
                        "WORKSPACE_ACTIVITY_READ",
                        "PROGRAM_READ", "PROGRAM_CREATE", "PROGRAM_UPDATE", "PROGRAM_DELETE",
                        "SUBJECT_READ", "SUBJECT_CREATE", "SUBJECT_UPDATE", "SUBJECT_DELETE",
                        "SESSION_CREATE", "SESSION_READ", "SESSION_UPDATE", "SESSION_DELETE",
                        "CLASS_READ", "ENROLLMENT_READ"
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
        grantWorkspaceLogAccess("MENTOR");
        grantWorkspaceLogAccess("PROGRAM_MANAGER");
        grantWorkspaceLogAccess("CLASS_ADMIN");

        log.info("Ensured roles and permission mappings: ADMIN, STUDENT, TEACHER.");
    }

    private void ensurePermission(String resource, String action) {
        String name = resource + "_" + action;
        if (permissionRepository.existsByName(name)) {
            return;
        }

        permissionRepository.save(Permission.builder()
                .name(name)
                .resource(resource)
                .action(action)
                .description("Manually defined permission")
                .build());
    }

    private void upsertRole(String roleName, String description, Collection<Permission> permissions) {
        Role role = roleRepository.findByName(roleName).orElseGet(Role::new);
        role.setName(roleName);
        role.setDescription(description);
        role.setIsSystem(true);
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
    private void grantWorkspaceLogAccess(String roleName) {
        roleRepository.findByName(roleName).ifPresent(role -> {
            role.getPermissions().addAll(findPermissions("WORKSPACE_READ", "WORKSPACE_MEMBER_READ",
                    "MILESTONE_READ", "SPRINT_READ", "WORKSPACE_ACTIVITY_READ"));
            roleRepository.save(role);
        });
    }
}
