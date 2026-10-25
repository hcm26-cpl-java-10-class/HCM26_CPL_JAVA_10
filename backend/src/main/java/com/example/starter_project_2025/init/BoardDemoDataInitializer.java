package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.Project;
import com.example.starter_project_2025.system.project.BoardProjectMember;
import com.example.starter_project_2025.system.project.BoardProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectRole;
import com.example.starter_project_2025.system.project.ProjectStatus;
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
import com.example.starter_project_2025.system.tenant.Tenant;
import com.example.starter_project_2025.system.tenant.TenantRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
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
    private static final String DEMO_ACTIVITY_CORRELATION_ID = "board-demo-seed-v1";

    TenantRepository tenantRepository;
    ProjectRepository projectRepository;
    BoardProjectMemberRepository projectMemberRepository;
    SprintRepository sprintRepository;
    TaskRepository taskRepository;
    ProjectActivityRepository projectActivityRepository;
    UserRepository userRepository;

    @Override
    @Transactional
    public void run(String... args) {
        Tenant tenant = upsertTenant("DEMO-TENANT", "Board Demo Tenant");
        Tenant otherTenant = upsertTenant("DEMO-OTHER-TENANT", "Other Demo Tenant");

        User student = requireUser(STUDENT_EMAIL);
        User teacher = requireUser(TEACHER_EMAIL);
        student.setTenantId(tenant.getId());
        teacher.setTenantId(tenant.getId());
        userRepository.saveAll(List.of(student, teacher));

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

        seedTask(project.getId(), sprint.getId(), studentMembership.getId(),
                "DEMO-101", "Prepare sprint backlog", TaskStatus.TODO, TaskPriority.MEDIUM, 1);
        seedTask(project.getId(), sprint.getId(), studentMembership.getId(),
                "DEMO-102", "Implement board endpoint", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, 2);
        seedTask(project.getId(), sprint.getId(), null,
                "DEMO-103", "Review acceptance criteria", TaskStatus.REVIEW, TaskPriority.MEDIUM, 3);
        seedTask(project.getId(), sprint.getId(), null,
                "DEMO-104", "Document API contract", TaskStatus.DONE, TaskPriority.LOW, 4);
        seedTask(project.getId(), sprint.getId(), null,
                "DEMO-105", "Resolve test environment issue", TaskStatus.BLOCKED, TaskPriority.CRITICAL, 5);
        seedTask(project.getId(), null, null,
                "DEMO-106", "Add accessibility checks", TaskStatus.TODO, TaskPriority.HIGH, 6);

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
                        "otherTenantProjectId={}, otherTenantSprintId={}",
                project.getId(),
                sprint.getId(),
                emptyProject.getId(),
                emptySprint.getId(),
                nonMemberProject.getId(),
                nonMemberSprint.getId(),
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
        Project project = projectRepository.findByCode(code).orElseGet(Project::new);
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
        Sprint sprint = sprintRepository.findByName(name).orElseGet(Sprint::new);
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
