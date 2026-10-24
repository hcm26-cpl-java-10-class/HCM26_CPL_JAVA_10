package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.Project;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectRole;
import com.example.starter_project_2025.system.project.activity.ProjectActivityLog;
import com.example.starter_project_2025.system.project.activity.ProjectActivityRepository;
import com.example.starter_project_2025.system.project.board.SprintSummaryResponse;
import com.example.starter_project_2025.system.project.board.TaskCardResponse;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintCorrelationIds;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.Task;
import com.example.starter_project_2025.system.project.sprint.TaskPriority;
import com.example.starter_project_2025.system.project.sprint.TaskRepository;
import com.example.starter_project_2025.system.project.sprint.TaskStatus;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxService;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.tenant.TenantRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectTaskServiceImpl implements ProjectTaskService {

    private static final List<ProjectRole> PROJECT_ROLES = List.of(
            ProjectRole.MEMBER,
            ProjectRole.TEAM_LEAD,
            ProjectRole.MENTOR
    );

    ProjectRepository projectRepository;
    ProjectMemberRepository projectMemberRepository;
    SprintRepository sprintRepository;
    TaskRepository taskRepository;
    TenantRepository tenantRepository;
    UserRepository userRepository;
    ProjectActivityRepository projectActivityRepository;
    TaskOutboxService taskOutboxService;
    ObjectMapper objectMapper;
    TaskStatusWorkflow taskStatusWorkflow;

    @Override
    @Transactional(readOnly = true)
    public List<ProjectTaskAssigneeResponse> getAssignees(Long projectId) {
        User actor = requireAuthenticatedActor();
        Project project = requireProjectScope(projectId, actor);

        List<ProjectMember> members = projectMemberRepository
                .findAllByProjectIdAndIsActiveTrueOrderByIdAsc(project.getId());
        Map<Long, User> usersById = userRepository.findAllById(
                        members.stream().map(ProjectMember::getUserId).toList()
                ).stream()
                .filter(user -> Boolean.TRUE.equals(user.getIsActive()))
                .collect(java.util.stream.Collectors.toMap(User::getId, user -> user));

        return members.stream()
                .filter(member -> usersById.containsKey(member.getUserId()))
                .map(member -> new ProjectTaskAssigneeResponse(
                        member.getId(),
                        usersById.get(member.getUserId()).getFullName()
                ))
                .toList();
    }

    @Override
    @Transactional
    public TaskCardResponse createTask(Long projectId, Long sprintId, CreateTaskRequest request) {
        User actor = requireAuthenticatedActor();
        Project project = requireProjectScope(projectId, actor);

        Sprint sprint = sprintRepository.findById(sprintId)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive()))
                .filter(candidate -> projectId.equals(candidate.getProjectId()))
                .orElseThrow(() -> new ResourceNotFoundException("Sprint", "id", sprintId));

        ProjectMember assigneeMember = resolveAssignee(projectId, request.assigneeProjectMemberId());
        User assignee = assigneeMember == null
                ? null
                : userRepository.findById(assigneeMember.getUserId())
                        .filter(user -> Boolean.TRUE.equals(user.getIsActive()))
                        .orElseThrow(() -> new TaskValidationException(
                                "assigneeProjectMemberId",
                                "Người phụ trách không còn hoạt động"
                        ));

        Task task = Task.builder()
                .projectId(projectId)
                .sprintId(sprint.getId())
                .assigneeProjectMemberId(assigneeMember == null ? null : assigneeMember.getId())
                .title(request.title().trim())
                .code("PENDING-" + UUID.randomUUID())
                .description(normalizeDescription(request.description()))
                .estimatedHours(request.estimatedHours())
                .priority(request.priority())
                .status(TaskStatus.TODO)
                .orderIndex(0)
                .version(0L)
                .isActive(true)
                .build();

        task = taskRepository.saveAndFlush(task);
        String taskCode = project.getCode() + "-" + task.getId();
        if (taskCode.length() > 50) {
            throw new TaskValidationException(
                    "code",
                    "Mã Project quá dài để tạo mã công việc (tối đa 50 ký tự)"
            );
        }
        task.setCode(taskCode);
        task = taskRepository.saveAndFlush(task);

        String correlationId = SprintCorrelationIds.current();
        Map<String, Object> afterState = Map.of(
                "taskId", task.getId(),
                "code", task.getCode(),
                "title", task.getTitle(),
                "status", task.getStatus().name()
        );
        projectActivityRepository.save(ProjectActivityLog.builder()
                .projectId(projectId)
                .actorId(actor.getId())
                .actorDisplayName(actor.getFullName())
                .actionType("TASK_CREATED")
                .entityType("TASK")
                .entityId(task.getId())
                .beforeState(null)
                .afterState(toJson(afterState))
                .correlationId(correlationId)
                .build());

try {
            taskOutboxService.enqueue(
                    task.getId(),
                    projectId,
                    task.getSprintId(),
                    actor.getId(),
                    correlationId,
                    afterState
            );
        } catch (Exception e) {
            log.error("Failed to enqueue task outbox event", e);
        }

        TaskCardResponse.AssigneeResponse assigneeResponse = assignee == null
                ? null
                : new TaskCardResponse.AssigneeResponse(assigneeMember.getId(), assignee.getFullName());
        log.info("Task created taskId={} projectId={} sprintId={} actorId={} correlationId={}",
                task.getId(), projectId, sprintId, actor.getId(), correlationId);

        return new TaskCardResponse(
                task.getId(),
                task.getCode(),
                task.getTitle(),
                assigneeResponse,
                task.getPriority(),
                task.getStatus(),
                task.getVersion(),
                task.getSprintId()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public ProjectTaskListResponse getTaskList(
            Long projectId,
            Long sprintId,
            TaskStatus status,
            Long assigneeProjectMemberId,
            Boolean unassigned,
            String search,
            int page,
            int size,
            String sortBy,
            String direction
    ) {
        User actor = requireAuthenticatedActor();
        Project project = requireProjectScope(projectId, actor);

        if (page < 0 || size < 1 || size > 100) {
            throw new TaskValidationException("page", "Trang phải >= 0 và kích thước phải từ 1 đến 100");
        }
        if (search != null && search.length() > 100) {
            throw new TaskValidationException("search", "Từ khóa tìm kiếm tối đa 100 ký tự");
        }
        if (Boolean.TRUE.equals(unassigned) && assigneeProjectMemberId != null) {
            throw new TaskValidationException(
                    "assigneeProjectMemberId",
                    "Không thể kết hợp bộ lọc chưa phân công với một thành viên cụ thể"
            );
        }
        Set<String> sortableFields = Set.of("code", "title", "status", "priority", "createdAt", "updatedAt");
        if (!sortableFields.contains(sortBy)) {
            throw new TaskValidationException("sortBy", "Trường sắp xếp không được hỗ trợ");
        }
        Sort.Direction sortDirection;
        try {
            sortDirection = Sort.Direction.fromString(direction);
        } catch (IllegalArgumentException exception) {
            throw new TaskValidationException("direction", "Chiều sắp xếp chỉ nhận ASC hoặc DESC");
        }

        Sprint sprint = null;
        if (sprintId != null) {
            sprint = sprintRepository.findById(sprintId)
                    .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive()))
                    .filter(candidate -> projectId.equals(candidate.getProjectId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Sprint", "id", sprintId));
        }
        if (assigneeProjectMemberId != null
                && projectMemberRepository.findByIdAndProjectIdAndIsActiveTrue(
                        assigneeProjectMemberId,
                        projectId
                ).isEmpty()) {
            throw new TaskValidationException(
                    "assigneeProjectMemberId",
                    "Người phụ trách phải là thành viên đang hoạt động của Project"
            );
        }

        Sort sort = Sort.by(sortDirection, sortBy).and(Sort.by(Sort.Direction.ASC, "id"));
        Page<Task> tasks = taskRepository.searchProjectTasks(
                projectId,
                sprintId,
                status,
                assigneeProjectMemberId,
                unassigned,
                search == null || search.isBlank() ? null : search.trim(),
                PageRequest.of(page, size, sort)
        );
        Map<Long, TaskCardResponse.AssigneeResponse> assignees = resolveAssignees(projectId, tasks.getContent());
        List<TaskListItemResponse> content = tasks.getContent().stream()
                .map(task -> new TaskListItemResponse(
                        task.getId(),
                        task.getCode(),
                        task.getTitle(),
                        task.getStatus(),
                        task.getAssigneeProjectMemberId() == null
                                ? null
                                : assignees.get(task.getAssigneeProjectMemberId()),
                        task.getPriority(),
                        task.getVersion()
                ))
                .toList();
        SprintSummaryResponse sprintSummary = sprint == null
                ? null
                : new SprintSummaryResponse(
                        sprint.getId(),
                        sprint.getName(),
                        sprint.getStartDate(),
                        sprint.getEndDate(),
                        sprint.getSprintGoal()
                );
        return new ProjectTaskListResponse(
                project.getId(),
                sprintSummary,
                content,
                tasks.getNumber(),
                tasks.getSize(),
                tasks.getTotalElements(),
                tasks.getTotalPages()
        );
    }

    @Override
    @Transactional
    public TaskStatusUpdateResponse updateStatus(
            Long projectId,
            Long taskId,
            TaskStatusUpdateRequest request
    ) {
        User actor = requireAuthenticatedActor();
        requireProjectScope(projectId, actor);
        Task task = taskRepository.findByIdAndProjectIdAndIsActiveTrue(taskId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", "id", taskId));

        String correlationId = SprintCorrelationIds.current();
        ProjectActivityLog previousRequest = findStatusChangeByCorrelation(projectId, taskId, correlationId);
        if (previousRequest != null) {
            StatusAuditState originalResult = parseAuditState(previousRequest.getAfterState());
            if (request.status().name().equals(originalResult.status())) {
                return new TaskStatusUpdateResponse(
                        taskId,
                        TaskStatus.valueOf(originalResult.status()),
                        originalResult.version(),
                        correlationId
                );
            }
            throw conflict("Correlation ID đã được dùng cho một yêu cầu đổi trạng thái khác", task);
        }

        if (!task.getVersion().equals(request.expectedVersion())) {
            throw conflict("Task đã được cập nhật bởi thao tác khác", task);
        }
        if (!taskStatusWorkflow.allows(task.getStatus(), request.status())) {
            throw conflict(
                    "Workflow không cho phép chuyển từ " + task.getStatus() + " sang " + request.status(),
                    task
            );
        }

        TaskStatus previousStatus = task.getStatus();
        Long newVersion = task.getVersion() + 1;
        int changed = taskRepository.updateStatusIfVersionMatches(
                projectId,
                taskId,
                request.status(),
                request.expectedVersion()
        );
        if (changed == 0) {
            ProjectActivityLog racedRequest = findStatusChangeByCorrelation(projectId, taskId, correlationId);
            if (racedRequest != null) {
                StatusAuditState originalResult = parseAuditState(racedRequest.getAfterState());
                if (request.status().name().equals(originalResult.status())) {
                    return new TaskStatusUpdateResponse(
                            taskId,
                            TaskStatus.valueOf(originalResult.status()),
                            originalResult.version(),
                            correlationId
                    );
                }
            }
            Task current = taskRepository.findByIdAndProjectIdAndIsActiveTrue(taskId, projectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Task", "id", taskId));
            throw conflict("Task đã được cập nhật bởi thao tác khác", current);
        }

        Map<String, Object> beforeState = Map.of(
                "status", previousStatus.name(),
                "version", request.expectedVersion()
        );
        Map<String, Object> afterState = Map.of(
                "status", request.status().name(),
                "version", newVersion
        );
        projectActivityRepository.save(ProjectActivityLog.builder()
                .projectId(projectId)
                .actorId(actor.getId())
                .actorDisplayName(actor.getFullName())
                .actionType("TASK_STATUS_CHANGED")
                .entityType("TASK")
                .entityId(taskId)
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .correlationId(correlationId)
                .build());
        taskOutboxService.enqueueStatusChanged(
                taskId,
                projectId,
                task.getSprintId(),
                actor.getId(),
                correlationId,
                Map.of(
                        "previousStatus", previousStatus.name(),
                        "status", request.status().name(),
                        "version", newVersion
                )
        );
        log.info("Task status changed taskId={} projectId={} from={} to={} actorId={} correlationId={}",
                taskId, projectId, previousStatus, request.status(), actor.getId(), correlationId);

        return new TaskStatusUpdateResponse(taskId, request.status(), newVersion, correlationId);
    }

    @Override
    @Transactional
    public TaskCardResponse updateTask(Long projectId, Long taskId, UpdateTaskRequest request) {
        User actor = requireAuthenticatedActor();
        requireProjectScope(projectId, actor);
        Task task = taskRepository.findByIdAndProjectIdAndIsActiveTrue(taskId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", "id", taskId));

        if (request.title() != null) {
            task.setTitle(request.title().trim());
        }
        if (request.description() != null) {
            task.setDescription(normalizeDescription(request.description()));
        }
        if (request.estimatedHours() != null) {
            task.setEstimatedHours(request.estimatedHours());
        }
        if (request.priority() != null) {
            task.setPriority(request.priority());
        }
        if (request.assigneeProjectMemberId() != null) {
            ProjectMember assigneeMember = resolveAssignee(projectId, request.assigneeProjectMemberId());
            task.setAssigneeProjectMemberId(assigneeMember == null ? null : assigneeMember.getId());
        } else if (request.assigneeProjectMemberId() == null && request.title() != null) {
            // Explicit null to unassign
            task.setAssigneeProjectMemberId(null);
        }

        task = taskRepository.saveAndFlush(task);

        String correlationId = SprintCorrelationIds.current();
        Map<String, Object> afterState = Map.of(
                "taskId", task.getId(),
                "code", task.getCode(),
                "title", task.getTitle(),
                "status", task.getStatus().name(),
                "priority", task.getPriority() != null ? task.getPriority().name() : null,
                "assigneeProjectMemberId", task.getAssigneeProjectMemberId()
        );
        projectActivityRepository.save(ProjectActivityLog.builder()
                .projectId(projectId)
                .actorId(actor.getId())
                .actorDisplayName(actor.getFullName())
                .actionType("TASK_UPDATED")
                .entityType("TASK")
                .entityId(task.getId())
                .beforeState(null)
                .afterState(toJson(afterState))
                .correlationId(correlationId)
                .build());

        taskOutboxService.enqueue(
                task.getId(),
                projectId,
                task.getSprintId(),
                actor.getId(),
                correlationId,
                afterState
        );

        TaskCardResponse.AssigneeResponse assigneeResponse = task.getAssigneeProjectMemberId() == null
                ? null
                : projectMemberRepository.findById(task.getAssigneeProjectMemberId())
                .map(m -> userRepository.findById(m.getUserId()).map(u -> new TaskCardResponse.AssigneeResponse(m.getId(), u.getFullName())).orElse(null))
                .orElse(null);

        log.info("Task updated taskId={} projectId={} actorId={} correlationId={}", task.getId(), projectId, actor.getId(), correlationId);

        return new TaskCardResponse(
                task.getId(),
                task.getCode(),
                task.getTitle(),
                assigneeResponse,
                task.getPriority(),
                task.getStatus(),
                task.getVersion(),
                task.getSprintId()
        );
    }

    @Override
    @Transactional
    public void deleteTask(Long projectId, Long taskId) {
        User actor = requireAuthenticatedActor();
        requireProjectScope(projectId, actor);
        Task task = taskRepository.findByIdAndProjectIdAndIsActiveTrue(taskId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", "id", taskId));

        if (task.getStatus() != TaskStatus.TODO) {
            throw new TaskValidationException("status", "Chỉ có thể xóa task ở trạng thái TODO");
        }

        task.setIsActive(false);
        taskRepository.saveAndFlush(task);

        String correlationId = SprintCorrelationIds.current();
        projectActivityRepository.save(ProjectActivityLog.builder()
                .projectId(projectId)
                .actorId(actor.getId())
                .actorDisplayName(actor.getFullName())
                .actionType("TASK_DELETED")
                .entityType("TASK")
                .entityId(taskId)
                .beforeState(null)
                .afterState(toJson(Map.of("taskId", taskId, "code", task.getCode())))
                .correlationId(correlationId)
                .build());

        log.info("Task deleted taskId={} projectId={} actorId={} correlationId={}", taskId, projectId, actor.getId(), correlationId);
    }

    @Override
    @Transactional
    public TaskStatusUpdateResponse moveTaskToSprint(Long projectId, Long taskId, MoveTaskToSprintRequest request) {
        User actor = requireAuthenticatedActor();
        requireProjectScope(projectId, actor);
        Task task = taskRepository.findByIdAndProjectIdAndIsActiveTrue(taskId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", "id", taskId));

        if (!task.getVersion().equals(request.expectedVersion())) {
            throw conflict("Task đã được cập nhật bởi thao tác khác", task);
        }

        Long newSprintId = request.sprintId();
        if (newSprintId != null) {
            Sprint sprint = sprintRepository.findById(newSprintId)
                    .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive()))
                    .filter(candidate -> projectId.equals(candidate.getProjectId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Sprint", "id", newSprintId));
        }

        Long previousSprintId = task.getSprintId();
        task.setSprintId(newSprintId);
        task.setVersion(task.getVersion() + 1);
        task = taskRepository.saveAndFlush(task);

        String correlationId = SprintCorrelationIds.current();
        Map<String, Object> beforeState = Map.of("sprintId", previousSprintId, "version", request.expectedVersion());
        Map<String, Object> afterState = Map.of("sprintId", newSprintId, "version", task.getVersion());
        projectActivityRepository.save(ProjectActivityLog.builder()
                .projectId(projectId)
                .actorId(actor.getId())
                .actorDisplayName(actor.getFullName())
                .actionType("TASK_MOVED_TO_SPRINT")
                .entityType("TASK")
                .entityId(taskId)
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .correlationId(correlationId)
                .build());

        taskOutboxService.enqueue(
                task.getId(),
                projectId,
                task.getSprintId(),
                actor.getId(),
                correlationId,
                afterState
        );

        log.info("Task moved to sprint taskId={} projectId={} fromSprintId={} toSprintId={} actorId={} correlationId={}",
                taskId, projectId, previousSprintId, newSprintId, actor.getId(), correlationId);

        return new TaskStatusUpdateResponse(taskId, task.getStatus(), task.getVersion(), correlationId);
    }

    @Override
    @Transactional
    public TaskStatusUpdateResponse assignTask(Long projectId, Long taskId, AssignTaskRequest request) {
        User actor = requireAuthenticatedActor();
        requireProjectScope(projectId, actor);
        Task task = taskRepository.findByIdAndProjectIdAndIsActiveTrue(taskId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", "id", taskId));

        if (!task.getVersion().equals(request.expectedVersion())) {
            throw conflict("Task đã được cập nhật bởi thao tác khác", task);
        }

        Long previousAssigneeId = task.getAssigneeProjectMemberId();
        if (request.assigneeProjectMemberId() != null) {
            ProjectMember assigneeMember = resolveAssignee(projectId, request.assigneeProjectMemberId());
            task.setAssigneeProjectMemberId(assigneeMember == null ? null : assigneeMember.getId());
        } else {
            task.setAssigneeProjectMemberId(null);
        }
        task.setVersion(task.getVersion() + 1);
        task = taskRepository.saveAndFlush(task);

        String correlationId = SprintCorrelationIds.current();
        Map<String, Object> beforeState = Map.of("assigneeProjectMemberId", previousAssigneeId, "version", request.expectedVersion());
        Map<String, Object> afterState = Map.of("assigneeProjectMemberId", task.getAssigneeProjectMemberId(), "version", task.getVersion());
        projectActivityRepository.save(ProjectActivityLog.builder()
                .projectId(projectId)
                .actorId(actor.getId())
                .actorDisplayName(actor.getFullName())
                .actionType("TASK_ASSIGNED")
                .entityType("TASK")
                .entityId(taskId)
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .correlationId(correlationId)
                .build());

        taskOutboxService.enqueue(
                task.getId(),
                projectId,
                task.getSprintId(),
                actor.getId(),
                correlationId,
                afterState
        );

        log.info("Task assigned taskId={} projectId={} fromAssigneeId={} toAssigneeId={} actorId={} correlationId={}",
                taskId, projectId, previousAssigneeId, task.getAssigneeProjectMemberId(), actor.getId(), correlationId);

        return new TaskStatusUpdateResponse(taskId, task.getStatus(), task.getVersion(), correlationId);
    }

    @Override
    @Transactional
    public TaskStatusUpdateResponse updateTaskOrder(Long projectId, Long taskId, UpdateTaskOrderRequest request) {
        User actor = requireAuthenticatedActor();
        requireProjectScope(projectId, actor);
        Task task = taskRepository.findByIdAndProjectIdAndIsActiveTrue(taskId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", "id", taskId));

        if (!task.getVersion().equals(request.expectedVersion())) {
            throw conflict("Task đã được cập nhật bởi thao tác khác", task);
        }

        task.setOrderIndex(request.orderIndex());
        task.setVersion(task.getVersion() + 1);
        task = taskRepository.saveAndFlush(task);

        String correlationId = SprintCorrelationIds.current();
        Map<String, Object> beforeState = Map.of("orderIndex", task.getOrderIndex() - 1, "version", request.expectedVersion());
        Map<String, Object> afterState = Map.of("orderIndex", task.getOrderIndex(), "version", task.getVersion());
        projectActivityRepository.save(ProjectActivityLog.builder()
                .projectId(projectId)
                .actorId(actor.getId())
                .actorDisplayName(actor.getFullName())
                .actionType("TASK_REORDERED")
                .entityType("TASK")
                .entityId(taskId)
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .correlationId(correlationId)
                .build());

        log.info("Task reordered taskId={} projectId={} orderIndex={} actorId={} correlationId={}",
                taskId, projectId, task.getOrderIndex(), actor.getId(), correlationId);

        return new TaskStatusUpdateResponse(taskId, task.getStatus(), task.getVersion(), correlationId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TaskStatusHistoryResponse> getStatusHistory(Long projectId, Long taskId) {
        User actor = requireAuthenticatedActor();
        requireProjectScope(projectId, actor);
        taskRepository.findByIdAndProjectIdAndIsActiveTrue(taskId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", "id", taskId));

        return projectActivityRepository
                .findByProjectIdAndEntityTypeAndEntityIdAndActionTypeOrderByOccurredAtDesc(
                        projectId,
                        "TASK",
                        taskId,
                        "TASK_STATUS_CHANGED",
                        PageRequest.of(0, 50)
                )
                .stream()
                .map(this::toStatusHistory)
                .toList();
    }

    private Map<Long, TaskCardResponse.AssigneeResponse> resolveAssignees(Long projectId, List<Task> tasks) {
        Set<Long> memberIds = tasks.stream()
                .map(Task::getAssigneeProjectMemberId)
                .filter(id -> id != null)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (memberIds.isEmpty()) return Map.of();

        List<ProjectMember> members = projectMemberRepository
                .findAllByIdInAndProjectIdAndIsActiveTrue(memberIds, projectId);
        Map<Long, User> usersById = new HashMap<>();
        userRepository.findAllById(members.stream().map(ProjectMember::getUserId).toList())
                .stream()
                .filter(user -> Boolean.TRUE.equals(user.getIsActive()))
                .forEach(user -> usersById.put(user.getId(), user));

        Map<Long, TaskCardResponse.AssigneeResponse> result = new HashMap<>();
        for (ProjectMember member : members) {
            User user = usersById.get(member.getUserId());
            if (user != null) {
                result.put(member.getId(), new TaskCardResponse.AssigneeResponse(member.getId(), user.getFullName()));
            }
        }
        return result;
    }

    private TaskStatusHistoryResponse toStatusHistory(ProjectActivityLog activity) {
        StatusAuditState before = parseAuditState(activity.getBeforeState());
        StatusAuditState after = parseAuditState(activity.getAfterState());
        return new TaskStatusHistoryResponse(
                activity.getId(),
                TaskStatus.valueOf(before.status()),
                TaskStatus.valueOf(after.status()),
                before.version(),
                after.version(),
                activity.getActorId(),
                activity.getActorDisplayName(),
                activity.getCorrelationId(),
                activity.getOccurredAt()
        );
    }

    private StatusAuditState parseAuditState(String serialized) {
        try {
            return objectMapper.readValue(serialized, StatusAuditState.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to read Task status audit state", exception);
        }
    }

    private ProjectActivityLog findStatusChangeByCorrelation(Long projectId, Long taskId, String correlationId) {
        return projectActivityRepository
                .findFirstByProjectIdAndEntityTypeAndEntityIdAndActionTypeAndCorrelationId(
                        projectId,
                        "TASK",
                        taskId,
                        "TASK_STATUS_CHANGED",
                        correlationId
                )
                .orElse(null);
    }

    private TaskConflictException conflict(String message, Task task) {
        return new TaskConflictException(message, task.getVersion(), task.getStatus());
    }

    private User requireAuthenticatedActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new AccessDeniedException("Authentication is required for project task operations");
        }
        if (!(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Authenticated user context is unavailable");
        }
        return principal.getUser();
    }

    private Project requireProjectScope(Long projectId, User actor) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", projectId));
        Long tenantId = actor.getTenantId();

        if (tenantId == null
                || !tenantId.equals(project.getTenantId())
                || !tenantRepository.existsByIdAndIsActiveTrue(tenantId)
                || !Boolean.TRUE.equals(project.getIsActive())
                || !projectMemberRepository.existsByProjectIdAndUserIdAndProjectRoleInAndIsActiveTrue(
                        projectId,
                        actor.getId(),
                        PROJECT_ROLES
                )) {
            throw new AccessDeniedException("Project is outside the user's active tenant or membership scope");
        }
        return project;
    }

    private ProjectMember resolveAssignee(Long projectId, Long memberId) {
        if (memberId == null) return null;
        return projectMemberRepository.findByIdAndProjectIdAndIsActiveTrue(memberId, projectId)
                .orElseThrow(() -> new TaskValidationException(
                        "assigneeProjectMemberId",
                        "Người phụ trách phải là thành viên đang hoạt động của Project"
                ));
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) return null;
        return description.trim();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize Task activity", exception);
        }
    }

    private record StatusAuditState(String status, Long version) {
    }
}
