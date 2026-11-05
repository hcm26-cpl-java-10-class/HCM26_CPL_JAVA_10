package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.BoardProjectMember;
import com.example.starter_project_2025.system.project.BoardProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.team.ProjectRole;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.activity.ProjectActivityLog;
import com.example.starter_project_2025.system.project.activity.ProjectActivityRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint.Task;
import com.example.starter_project_2025.system.project.sprint.TaskPriority;
import com.example.starter_project_2025.system.project.sprint.TaskRepository;
import com.example.starter_project_2025.system.project.sprint.TaskStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Order(13)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@ConditionalOnProperty(name = "app.seed.board.enabled", havingValue = "true")
public class BoardDemoDataInitializer implements CommandLineRunner {

    private static final String STUDENT_EMAIL = "student@example.com";
    private static final String TEACHER_EMAIL = "teacher@example.com";
    private static final String DEFAULT_ADMIN_EMAIL = "admin@example.com";
    private static final String DEMO_ACTIVITY_CORRELATION_ID = "board-demo-seed-v1";

    TenantRepository tenantRepository;
    ProjectRepository projectRepository;
    BoardProjectMemberRepository projectMemberRepository;
    SprintRepository sprintRepository;
    TaskRepository taskRepository;
    ProjectActivityRepository projectActivityRepository;
    UserRepository userRepository;
    com.example.starter_project_2025.system.project.workspace.config.LegacyH2ProjectSchemaMigration legacyMigration;

    @Value("${app.seed.admin.email:" + DEFAULT_ADMIN_EMAIL + "}")
    @NonFinal
    String adminEmail;

    @Override
    @Transactional
    public void run(String... args) {
        if (legacyMigration.isMigratedDatabase()) {
            log.info("Board demo seed skipped to preserve imported project data.");
            return;
        }
        User student = requireUser(STUDENT_EMAIL);
        User teacher = requireUser(TEACHER_EMAIL);
        User admin = requireUser(adminEmail);
        Tenant tenant = student.getTenant();
        if (tenant == null || teacher.getTenant() == null
                || !tenant.getId().equals(teacher.getTenant().getId())
                || !Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) {
            log.warn("Board demo skipped: the existing student and teacher must share an active tenant");
            return;
        }
        Tenant otherTenant = upsertTenant("DEMO-OTHER-TENANT", "Other Demo Tenant");

        Project project = upsertProject(
                tenant.getId(),
                "DEMO-BOARD",
                "Kanban Board Demo",
                ProjectStatus.ACTIVE
        );
        Project emptyProject = upsertProject(
                tenant.getId(),
                "DEMO-EMPTY-BOARD",
                "Board Demo - Empty",
                ProjectStatus.ACTIVE
        );
        Project nonMemberProject = upsertProject(
                tenant.getId(),
                "DEMO-NON-MEMBER",
                "Board Demo - No Membership",
                ProjectStatus.ACTIVE
        );
        Project otherTenantProject = upsertProject(
                otherTenant.getId(),
                "DEMO-OTHER-SCOPE",
                "Board Demo - Other Tenant",
                ProjectStatus.ACTIVE
        );

        BoardProjectMember studentMembership = upsertMembership(
                project.getId(), student.getId(), ProjectRole.MEMBER
        );
        upsertMembership(project.getId(), teacher.getId(), ProjectRole.MENTOR);
        upsertMembership(emptyProject.getId(), student.getId(), ProjectRole.MEMBER);

        // The role switch changes only the frontend preview. Keep the admin's
        // demo Board data in the admin's own tenant so tenant isolation remains intact.
        Long adminTenantId = admin.getTenantId();
        if (adminTenantId == null || !tenantRepository.existsByIdAndIsActiveTrue(adminTenantId)) {
            throw new IllegalStateException("Admin user must belong to an active tenant: " + adminEmail);
        }
        Project adminProject = upsertProject(
                adminTenantId,
                "DEMO-ADMIN-BOARD",
                "Kanban Board Demo",
                ProjectStatus.ACTIVE
        );
        Project adminEmptyProject = upsertProject(
                adminTenantId,
                "DEMO-ADMIN-EMPTY-BOARD",
                "Board Demo - Empty",
                ProjectStatus.ACTIVE
        );
        BoardProjectMember adminMembership = upsertMembership(
                adminProject.getId(), admin.getId(), ProjectRole.MENTOR
        );
        upsertMembership(adminEmptyProject.getId(), admin.getId(), ProjectRole.MENTOR);

        Sprint sprint = upsertSprint(
                project.getId(),
                "Board Demo Sprint",
                "Sample sprint for testing all six board columns",
                SprintStatus.ACTIVE
        );
        Sprint emptySprint = upsertSprint(
                emptyProject.getId(),
                "Board Demo Empty Project Sprint",
                "Empty project sprint for testing the no-tasks state",
                SprintStatus.PLANNED
        );
        Sprint nonMemberSprint = upsertSprint(
                nonMemberProject.getId(),
                "Board Demo Non-Member Sprint",
                "Used to verify project membership enforcement",
                SprintStatus.ACTIVE
        );
        Sprint otherTenantSprint = upsertSprint(
                otherTenantProject.getId(),
                "Board Demo Other-Tenant Sprint",
                "Used to verify tenant scope enforcement",
                SprintStatus.ACTIVE
        );
        Sprint adminSprint = upsertSprint(
                adminProject.getId(),
                "Admin Board Demo Sprint",
                "Sample sprint for Admin and role-preview Board access",
                SprintStatus.ACTIVE
        );
        upsertSprint(
                adminEmptyProject.getId(),
                "Admin Board Demo Empty Sprint",
                "Empty project sprint for testing the no-tasks state",
                SprintStatus.PLANNED
        );

        seedTask(project.getId(), sprint.getId(), studentMembership.getId(),
                "DEMO-101", "Prepare sprint backlog", TaskStatus.TODO, TaskPriority.MEDIUM, 1);
        seedTask(project.getId(), sprint.getId(), studentMembership.getId(),
                "DEMO-102", "Implement board endpoint", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, 2);
        seedTask(project.getId(), sprint.getId(), null,
                "DEMO-103", "Review acceptance criteria", TaskStatus.REVIEW, TaskPriority.MEDIUM, 3);
        seedTask(project.getId(), sprint.getId(), null,
                "DEMO-104", "Document API contract", TaskStatus.DONE, TaskPriority.LOW, 4);
        seedTask(project.getId(), sprint.getId(), null,
                "DEMO-105", "Resolve test environment issue", TaskStatus.REVIEW, TaskPriority.CRITICAL, 5);
        seedTask(project.getId(), null, null,
                "DEMO-106", "Add accessibility checks", TaskStatus.TODO, TaskPriority.HIGH, 6);
        seedTask(adminProject.getId(), adminSprint.getId(), adminMembership.getId(),
                "ADMIN-DEMO-101", "Prepare sprint backlog", TaskStatus.TODO, TaskPriority.MEDIUM, 1);
        seedTask(adminProject.getId(), adminSprint.getId(), adminMembership.getId(),
                "ADMIN-DEMO-102", "Implement board endpoint", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, 2);
        seedTask(adminProject.getId(), adminSprint.getId(), null,
                "ADMIN-DEMO-103", "Review acceptance criteria", TaskStatus.REVIEW, TaskPriority.MEDIUM, 3);

        if (!projectActivityRepository.existsByCorrelationId(DEMO_ACTIVITY_CORRELATION_ID)) {
            projectActivityRepository.save(ProjectActivityLog.builder()
                    .projectId(project.getId())
                    .actorId(student.getId())
                    .actorDisplayName(student.getFullName())
                    .actionType("TASK_STATUS_CHANGED")
                    .entityType("TASK")
                    .entityId(null)
                    .beforeState("{\"status\":\"TODO\"}")
                    .afterState("{\"status\":\"IN_PROGRESS\"}")
                    .correlationId(DEMO_ACTIVITY_CORRELATION_ID)
                    .build());
        }

        log.info(
                "Board demo data enabled: login student@example.com / password123; " +
                        "projectId={}, sprintId={}, emptyProjectId={}, emptySprintId={}, " +
                        "nonMemberProjectId={}, nonMemberSprintId={}, " +
                        "adminProjectId={}, adminSprintId={}, adminEmptyProjectId={}, " +
                        "otherTenantProjectId={}, otherTenantSprintId={}",
                project.getId(),
                sprint.getId(),
                emptyProject.getId(),
                emptySprint.getId(),
                nonMemberProject.getId(),
                nonMemberSprint.getId(),
                adminProject.getId(),
                adminSprint.getId(),
                adminEmptyProject.getId(),
                otherTenantProject.getId(),
                otherTenantSprint.getId()
        );
    }

    private Tenant upsertTenant(String code, String name) {
        Tenant tenant = tenantRepository.findByCode(code).orElseGet(Tenant::new);
        tenant.setCode(code);
        tenant.setName(name);
        tenant.setIsActive(true);
        return tenantRepository.save(tenant);
    }

    private Project upsertProject(Long tenantId, String code, String name, ProjectStatus status) {
        Project project = projectRepository.findByCodeAndTenantId(code, tenantId).orElseGet(Project::new);
        project.setTenantId(tenantId);
        project.setCode(code);
        project.setName(name);
        project.setStatus(status);
        project.setIsActive(true);
        return projectRepository.save(project);
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .filter(user -> Boolean.TRUE.equals(user.getIsActive()))
                .orElseThrow(() -> new IllegalStateException(
                        "Seed user not found or inactive: " + email
                ));
    }

    private BoardProjectMember upsertMembership(Long projectId, Long userId, ProjectRole role) {
        BoardProjectMember member = projectMemberRepository.findByProjectIdAndUserIdAndProjectRole(
                        projectId, userId, role
                )
                .orElseGet(BoardProjectMember::new);
        member.setProjectId(projectId);
        member.setUserId(userId);
        member.setProjectRole(role);
        member.setIsActive(true);
        return projectMemberRepository.save(member);
    }

    private Sprint upsertSprint(
            Long projectId,
            String name,
            String goal,
            SprintStatus status
    ) {
        LocalDate today = LocalDate.now();
        Sprint sprint = sprintRepository.findFirstByProjectIdAndNameOrderByIdAsc(projectId, name)
                .orElseGet(Sprint::new);
        sprint.setProjectId(projectId);
        sprint.setName(name);
        sprint.setSprintGoal(goal);
        sprint.setStartDate(today.minusDays(2).atStartOfDay());
        sprint.setEndDate(today.plusDays(12).atStartOfDay());
        sprint.setStatus(status);
        sprint.setIsActive(true);
        return sprintRepository.save(sprint);
    }

    private void seedTask(
            Long projectId,
            Long sprintId,
            Long assigneeProjectMemberId,
            String code,
            String title,
            TaskStatus status,
            TaskPriority priority,
            int orderIndex
    ) {
        Task task = taskRepository.findByProjectIdAndCode(projectId, code)
                .orElseGet(Task::new);
        task.setProjectId(projectId);
        task.setSprintId(sprintId);
        task.setAssigneeProjectMemberId(assigneeProjectMemberId);
        task.setCode(code);
        task.setTitle(title);
        task.setStatus(status);
        task.setPriority(priority);
        task.setOrderIndex(orderIndex);
        task.setIsActive(true);
        taskRepository.save(task);
    }
}
