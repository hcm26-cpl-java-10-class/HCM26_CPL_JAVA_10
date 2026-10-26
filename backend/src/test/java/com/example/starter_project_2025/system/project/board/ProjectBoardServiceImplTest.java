package com.example.starter_project_2025.system.project.board;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.BoardProjectMember;
import com.example.starter_project_2025.system.project.BoardProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.team.ProjectRole;
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
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectBoardServiceImplTest {

    @Mock
    ProjectRepository projectRepository;

    @Mock
    BoardProjectMemberRepository projectMemberRepository;

    @Mock
    SprintRepository sprintRepository;

    @Mock
    TaskRepository taskRepository;

    @Mock
    TenantRepository tenantRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    ProjectActivityRepository projectActivityRepository;

    @InjectMocks
    ProjectBoardServiceImpl service;

    @BeforeEach
    void authenticateBoardMember() {
        User user = User.builder()
                .id(7L)
                .tenantId(3L)
                .firstName("Test")
                .lastName("Member")
                .isActive(true)
                .build();
        UserPrincipal principal = new UserPrincipal(
                user,
                List.of()
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        principal.getAuthorities()
                )
        );
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returnsSixColumnsAndOnlyProjectBacklogAndSelectedSprintTasks() {
        Project project = Project.builder()
                .id(11L)
                .tenantId(3L)
                .isActive(true)
                .build();
        Sprint sprint = Sprint.builder()
                .id(19L)
                .projectId(11L)
                .name("Sprint 1")
                .sprintGoal("Deliver board")
                .startDate(LocalDateTime.parse("2026-10-01T00:00:00"))
                .endDate(LocalDateTime.parse("2026-10-14T00:00:00"))
                .status(SprintStatus.ACTIVE)
                .isActive(true)
                .build();
        Task backlogTask = task(1L, "TASK-001", null, TaskStatus.TODO);
        List<Task> sprintTasks = List.of(
                task(2L, "TASK-002", 19L, TaskStatus.TODO),
                task(3L, "TASK-003", 19L, TaskStatus.IN_PROGRESS),
                task(4L, "TASK-004", 19L, TaskStatus.REVIEW),
                task(5L, "TASK-005", 19L, TaskStatus.DONE),
                task(6L, "TASK-006", 19L, TaskStatus.BLOCKED)
        );

        when(projectRepository.findById(11L)).thenReturn(Optional.of(project));
        when(tenantRepository.existsByIdAndIsActiveTrue(3L)).thenReturn(true);
        when(projectMemberRepository.existsByProjectIdAndUserIdAndProjectRoleInAndIsActiveTrue(
                11L,
                7L,
                List.of(ProjectRole.MEMBER, ProjectRole.TEAM_LEAD, ProjectRole.MENTOR)
        )).thenReturn(true);
        when(sprintRepository.findById(19L)).thenReturn(Optional.of(sprint));
        when(taskRepository.findByProjectIdAndSprintIdIsNullAndIsActiveTrueOrderByOrderIndexAscIdAsc(11L))
                .thenReturn(List.of(backlogTask));
        when(taskRepository.findByProjectIdAndSprintIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(11L, 19L))
                .thenReturn(sprintTasks);
        when(projectActivityRepository.findByProjectIdOrderByOccurredAtDesc(11L, PageRequest.of(0, 20)))
                .thenReturn(List.of());

        ProjectBoardResponse result = service.getBoard(11L, 19L);

        assertEquals(11L, result.projectId());
        assertEquals("Sprint 1", result.sprint().name());
        assertEquals(6, result.columns().size());
        assertEquals(List.of("BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"),
                result.columns().stream().map(BoardColumnResponse::key).toList());
        assertEquals(1, result.columns().get(0).count());
        assertEquals("TASK-001", result.columns().get(0).tasks().get(0).code());
        assertEquals(List.of(1, 1, 1, 1, 1, 1),
                result.columns().stream().map(BoardColumnResponse::count).toList());
        assertEquals(List.of(), result.activityTrail());
        verify(taskRepository, never()).save(any(Task.class));
        verify(projectActivityRepository, never()).save(any());
    }

    @Test
    void listsOnlyActiveProjectsInCurrentTenantForCurrentMember() {
        Project project = Project.builder()
                .id(11L)
                .tenantId(3L)
                .code("DEMO")
                .name("Demo Project")
                .isActive(true)
                .build();
        when(tenantRepository.existsByIdAndIsActiveTrue(3L)).thenReturn(true);
        when(projectMemberRepository.findAllByUserIdAndProjectRoleInAndIsActiveTrueOrderByProjectIdAsc(
                eq(7L),
                eq(List.of(ProjectRole.MEMBER, ProjectRole.TEAM_LEAD, ProjectRole.MENTOR))
        )).thenReturn(List.of(
                BoardProjectMember.builder().projectId(11L).build(),
                BoardProjectMember.builder().projectId(11L).build()
        ));
        when(projectRepository.findAllByTenantIdAndIdInAndIsActiveTrueOrderByNameAsc(3L, List.of(11L)))
                .thenReturn(List.of(project));

        List<ProjectBoardProjectOption> result = service.getAccessibleProjects();

        assertEquals(List.of(new ProjectBoardProjectOption(11L, "DEMO", "Demo Project")), result);
    }

    @Test
    void returnsAllEmptyColumnsWhenProjectHasNoVisibleTasks() {
        Project project = Project.builder()
                .id(11L)
                .tenantId(3L)
                .isActive(true)
                .build();
        Sprint sprint = Sprint.builder()
                .id(19L)
                .projectId(11L)
                .name("Empty Sprint")
                .isActive(true)
                .build();

        when(projectRepository.findById(11L)).thenReturn(Optional.of(project));
        when(tenantRepository.existsByIdAndIsActiveTrue(3L)).thenReturn(true);
        when(projectMemberRepository.existsByProjectIdAndUserIdAndProjectRoleInAndIsActiveTrue(
                11L,
                7L,
                List.of(ProjectRole.MEMBER, ProjectRole.TEAM_LEAD, ProjectRole.MENTOR)
        )).thenReturn(true);
        when(sprintRepository.findById(19L)).thenReturn(Optional.of(sprint));
        when(taskRepository.findByProjectIdAndSprintIdIsNullAndIsActiveTrueOrderByOrderIndexAscIdAsc(11L))
                .thenReturn(List.of());
        when(taskRepository.findByProjectIdAndSprintIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(11L, 19L))
                .thenReturn(List.of());
        when(projectActivityRepository.findByProjectIdOrderByOccurredAtDesc(11L, PageRequest.of(0, 20)))
                .thenReturn(List.of());

        ProjectBoardResponse result = service.getBoard(11L, 19L);

        assertEquals(6, result.columns().size());
        assertEquals(List.of(0, 0, 0, 0, 0, 0),
                result.columns().stream().map(BoardColumnResponse::count).toList());
        assertEquals(List.of(List.of(), List.of(), List.of(), List.of(), List.of(), List.of()),
                result.columns().stream().map(BoardColumnResponse::tasks).toList());
    }

    @Test
    void deniesBoardReadWhenActorIsOutsideProjectTenant() {
        Project project = Project.builder()
                .id(11L)
                .tenantId(99L)
                .isActive(true)
                .build();
        when(projectRepository.findById(11L)).thenReturn(Optional.of(project));

        assertThrows(AccessDeniedException.class, () -> service.getBoard(11L, 19L));
        verify(sprintRepository, never()).findById(19L);
        verify(taskRepository, never()).findByProjectIdAndSprintIdIsNullAndIsActiveTrueOrderByOrderIndexAscIdAsc(11L);
    }

    @Test
    void returnsNotFoundWhenProjectDoesNotExist() {
        when(projectRepository.findById(11L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.getBoard(11L, 19L));
        verify(sprintRepository, never()).findById(19L);
    }

    private Task task(Long id, String code, Long sprintId, TaskStatus status) {
        return Task.builder()
                .id(id)
                .projectId(11L)
                .sprintId(sprintId)
                .title("Task " + code)
                .code(code)
                .priority(TaskPriority.HIGH)
                .status(status)
                .isActive(true)
                .build();
    }
}
