package com.example.starter_project_2025.system.project.board;

import com.example.starter_project_2025.init.BoardDemoDataInitializer;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.project.sprint.Task;
import com.example.starter_project_2025.system.project.sprint.TaskRepository;
import com.example.starter_project_2025.system.project.sprint.TaskStatus;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.task.ProjectTaskService;
import com.example.starter_project_2025.system.project.task.MoveTaskToSprintRequest;
import com.example.starter_project_2025.system.project.task.TaskValidationException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(properties = {"app.seed.board.enabled=true", "app.seed.team-allocation.enabled=false"})
@ActiveProfiles("test")
@Transactional
class BoardDemoTenantIntegrationTest {
    @Autowired private BoardDemoDataInitializer initializer;
    @Autowired private UserRepository users;
    @Autowired private ProjectRepository projects;
    @Autowired private EntityManager entityManager;
    @Autowired private TaskRepository tasks;
    @Autowired private SprintRepository sprints;
    @Autowired private ProjectTaskService taskService;
    @Autowired private UserDetailsService userDetails;

    @Test
    void boardSeedReusesSharedTenantWithoutReassigningExistingAccounts() {
        Long tenantId = users.findByEmail("admin@example.com").orElseThrow().getTenantId();
        assertThat(users.findByEmail("student@example.com").orElseThrow().getTenantId()).isEqualTo(tenantId);
        assertThat(users.findByEmail("teacher@example.com").orElseThrow().getTenantId()).isEqualTo(tenantId);

        initializer.run();
        entityManager.flush();
        entityManager.clear();

        assertThat(users.findByEmail("student@example.com").orElseThrow().getTenant().getId()).isEqualTo(tenantId);
        assertThat(users.findByEmail("teacher@example.com").orElseThrow().getTenant().getId()).isEqualTo(tenantId);
        assertThat(projects.findByCodeAndTenantId("DEMO-BOARD", tenantId)).isPresent();
    }

    @Test
    void projectBoardBacklogOnlyConnectsToTodoAndRecordsNullableSprintIds() {
        var student = users.findByEmail("student@example.com").orElseThrow();
        var project = projects.findByCodeAndTenantId("DEMO-BOARD", student.getTenantId()).orElseThrow();
        var sprint = sprints.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(project.getId()).get(0);
        var task = tasks.saveAndFlush(Task.builder().projectId(project.getId()).sprintId(sprint.getId())
                .title("Backlog adjacency regression").code("ADJ-" + java.util.UUID.randomUUID().toString().substring(0, 8))
                .status(TaskStatus.IN_PROGRESS).build());
        var principal = userDetails.loadUserByUsername(student.getEmail());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        try {
            assertThrows(TaskValidationException.class, () -> taskService.moveTaskToSprint(project.getId(), task.getId(),
                    new MoveTaskToSprintRequest(null, task.getVersion())));
            assertThat(task.getSprintId()).isEqualTo(sprint.getId());
            task.setStatus(TaskStatus.TODO);
            tasks.saveAndFlush(task);
            taskService.moveTaskToSprint(project.getId(), task.getId(), new MoveTaskToSprintRequest(null, task.getVersion()));
            assertThat(tasks.findById(task.getId()).orElseThrow().getSprintId()).isNull();
            taskService.moveTaskToSprint(project.getId(), task.getId(), new MoveTaskToSprintRequest(sprint.getId(), task.getVersion()));
            assertThat(tasks.findById(task.getId()).orElseThrow().getSprintId()).isEqualTo(sprint.getId());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
