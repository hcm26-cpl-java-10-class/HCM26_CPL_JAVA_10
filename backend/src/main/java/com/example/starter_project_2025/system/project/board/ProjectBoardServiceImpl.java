package com.example.starter_project_2025.system.project.board;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.Project;
import com.example.starter_project_2025.system.project.BoardProjectMember;
import com.example.starter_project_2025.system.project.BoardProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectRole;
import com.example.starter_project_2025.system.project.activity.ProjectActivityLog;
import com.example.starter_project_2025.system.project.activity.ProjectActivityRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.Task;
import com.example.starter_project_2025.system.project.sprint.TaskRepository;
import com.example.starter_project_2025.system.project.sprint.TaskStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.tenant.TenantRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectBoardServiceImpl implements ProjectBoardService {

    private static final int ACTIVITY_LIMIT = 20;

    private static final List<ProjectRole> BOARD_ROLES = List.of(
            ProjectRole.MEMBER,
            ProjectRole.TEAM_LEAD,
            ProjectRole.MENTOR
    );

    private static final List<ColumnDefinition> COLUMNS = List.of(
            new ColumnDefinition("BACKLOG", "Backlog", null),
            new ColumnDefinition("TODO", "To do", TaskStatus.TODO),
            new ColumnDefinition("IN_PROGRESS", "In progress", TaskStatus.IN_PROGRESS),
            new ColumnDefinition("REVIEW", "Review", TaskStatus.REVIEW),
            new ColumnDefinition("DONE", "Done", TaskStatus.DONE),
            new ColumnDefinition("BLOCKED", "Blocked", TaskStatus.BLOCKED)
    );

    ProjectRepository projectRepository;
    BoardProjectMemberRepository projectMemberRepository;
    SprintRepository sprintRepository;
    TaskRepository taskRepository;
    TenantRepository tenantRepository;
    UserRepository userRepository;
    ProjectActivityRepository projectActivityRepository;

    @Override
    @Transactional(readOnly = true)
    public List<ProjectBoardProjectOption> getAccessibleProjects() {
        User actor = requireAuthenticatedActor();
        Long tenantId = actor.getTenantId();
        if (tenantId == null || !tenantRepository.existsByIdAndIsActiveTrue(tenantId)) {
            throw new AccessDeniedException("Tenant is inactive or unavailable");
        }

        List<Long> projectIds = projectMemberRepository
                .findAllByUserIdAndProjectRoleInAndIsActiveTrueOrderByProjectIdAsc(actor.getId(), BOARD_ROLES)
                .stream()
                .map(BoardProjectMember::getProjectId)
                .distinct()
                .toList();
        if (projectIds.isEmpty()) {
            return List.of();
        }

        return projectRepository
                .findAllByTenantIdAndIdInAndIsActiveTrueOrderByNameAsc(tenantId, projectIds)
                .stream()
                .map(project -> new ProjectBoardProjectOption(
                        project.getId(),
                        project.getCode(),
                        project.getName()
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProjectBoardSprintOption> getProjectSprints(Long projectId) {
        User actor = requireAuthenticatedActor();
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        verifyObjectScope(actor, project);

        return sprintRepository.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(projectId)
                .stream()
                .map(sprint -> new ProjectBoardSprintOption(
                        sprint.getId(),
                        sprint.getName(),
                        sprint.getStatus(),
                        sprint.getStartDate(),
                        sprint.getEndDate()
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProjectBoardResponse getBoard(Long projectId, Long sprintId) {
        User actor = requireAuthenticatedActor();

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));

        verifyObjectScope(actor, project);

        Sprint sprint = sprintRepository.findById(sprintId)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive()))
                .filter(candidate -> projectId.equals(candidate.getProjectId()))
                .orElseThrow(() -> new ResourceNotFoundException("Sprint", "id", sprintId));

        List<Task> backlog = taskRepository
                .findByProjectIdAndSprintIdIsNullAndIsActiveTrueOrderByOrderIndexAscIdAsc(projectId);
        List<Task> sprintTasks = taskRepository
                .findByProjectIdAndSprintIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(projectId, sprintId);
        List<Task> visibleTasks = new ArrayList<>(backlog.size() + sprintTasks.size());
        visibleTasks.addAll(backlog);
        visibleTasks.addAll(sprintTasks);

        Map<Long, TaskCardResponse.AssigneeResponse> assignees = resolveAssignees(projectId, visibleTasks);
        List<BoardColumnResponse> columns = buildColumns(backlog, sprintTasks, assignees);
        List<ActivityItemResponse> activity = projectActivityRepository
                .findByProjectIdOrderByOccurredAtDesc(projectId, PageRequest.of(0, ACTIVITY_LIMIT))
                .stream()
                .map(this::toActivityResponse)
                .toList();

        return new ProjectBoardResponse(
                projectId,
                new SprintSummaryResponse(
                        sprint.getId(),
                        sprint.getName(),
                        sprint.getStartDate(),
                        sprint.getEndDate(),
                        sprint.getSprintGoal()
                ),
                columns,
                activity
        );
    }

    private User requireAuthenticatedActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new AccessDeniedException("Authentication is required to view project boards");
        }

        if (!(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Authenticated user context is unavailable");
        }

        return principal.getUser();
    }

    private void verifyObjectScope(User actor, Project project) {
        Long tenantId = actor.getTenantId();

        if (tenantId == null || !tenantId.equals(project.getTenantId())) {
            throw new AccessDeniedException("Project is outside the user's tenant scope");
        }

        if (!tenantRepository.existsByIdAndIsActiveTrue(tenantId)) {
            throw new AccessDeniedException("Tenant is inactive");
        }

        if (!Boolean.TRUE.equals(project.getIsActive())) {
            throw new AccessDeniedException("Project is inactive");
        }

        if (!projectMemberRepository.existsByProjectIdAndUserIdAndProjectRoleInAndIsActiveTrue(
                project.getId(),
                actor.getId(),
                BOARD_ROLES
        )) {
            throw new AccessDeniedException("User is not an active project member or assigned mentor");
        }
    }

    private Map<Long, TaskCardResponse.AssigneeResponse> resolveAssignees(
            Long projectId,
            Collection<Task> tasks
    ) {
        Set<Long> memberIds = tasks.stream()
                .map(Task::getAssigneeProjectMemberId)
                .filter(id -> id != null)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (memberIds.isEmpty()) {
            return Map.of();
        }

        List<BoardProjectMember> members = projectMemberRepository
                .findAllByIdInAndProjectIdAndIsActiveTrue(memberIds, projectId);
        Set<Long> userIds = members.stream()
                .map(BoardProjectMember::getUserId)
                .collect(Collectors.toSet());
        Map<Long, User> usersById = new HashMap<>();
        userRepository.findAllById(userIds).forEach(user -> usersById.put(user.getId(), user));

        Map<Long, TaskCardResponse.AssigneeResponse> result = new HashMap<>();
        for (BoardProjectMember member : members) {
            User user = usersById.get(member.getUserId());
            if (user != null && Boolean.TRUE.equals(user.getIsActive())) {
                result.put(
                        member.getId(),
                        new TaskCardResponse.AssigneeResponse(member.getId(), user.getFullName())
                );
            }
        }

        return result;
    }

    private List<BoardColumnResponse> buildColumns(
            List<Task> backlog,
            List<Task> sprintTasks,
            Map<Long, TaskCardResponse.AssigneeResponse> assignees
    ) {
        Map<TaskStatus, List<Task>> tasksByStatus = new EnumMap<>(TaskStatus.class);
        for (TaskStatus status : TaskStatus.values()) {
            tasksByStatus.put(status, new ArrayList<>());
        }

        for (Task task : sprintTasks) {
            if (task.getStatus() == null) {
                throw new IllegalStateException("Task has a status that cannot be displayed on the Board");
            }
            tasksByStatus.get(task.getStatus()).add(task);
        }

        return COLUMNS.stream()
                .map(column -> {
                    List<Task> tasks = column.status() == null
                            ? backlog
                            : tasksByStatus.get(column.status());
                    List<TaskCardResponse> cards = tasks.stream()
                            .map(task -> toTaskCard(task, assignees))
                            .toList();
                    return new BoardColumnResponse(column.key(), column.name(), cards.size(), cards);
                })
                .toList();
    }

    private TaskCardResponse toTaskCard(
            Task task,
            Map<Long, TaskCardResponse.AssigneeResponse> assignees
    ) {
        if (task.getCode() == null || task.getCode().isBlank()) {
            throw new IllegalStateException("Task code is required to display a Board card");
        }

        return new TaskCardResponse(
                task.getId(),
                task.getCode(),
                task.getTitle(),
                task.getAssigneeProjectMemberId() == null
                        ? null
                        : assignees.get(task.getAssigneeProjectMemberId()),
                task.getPriority(),
                task.getStatus(),
                task.getVersion(),
                task.getSprintId()
        );
    }

    private ActivityItemResponse toActivityResponse(ProjectActivityLog activity) {
        return new ActivityItemResponse(
                activity.getId(),
                activity.getActorId(),
                activity.getActorDisplayName(),
                activity.getActionType(),
                activity.getEntityType(),
                activity.getEntityId(),
                activity.getBeforeState(),
                activity.getAfterState(),
                activity.getCorrelationId(),
                activity.getOccurredAt()
        );
    }

    private record ColumnDefinition(String key, String name, TaskStatus status) {
    }
}
