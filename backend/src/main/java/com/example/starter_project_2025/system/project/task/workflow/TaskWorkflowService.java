package com.example.starter_project_2025.system.project.task.workflow;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.audit.TaskActivityDTO;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditService;
import com.example.starter_project_2025.system.project.task.dependency.*;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class TaskWorkflowService {
    private final TaskRepository taskRepository;
    private final TaskDependencyRepository dependencyRepository;
    private final TaskMapper taskMapper;
    private final TaskAccessService taskAccess;
    private final TaskAuditService auditService;
    private final TaskOutboxService outboxService;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public TaskWorkflowDTO getWorkflow(UUID taskId) {
        Long actorId = taskAccess.requirePermission("TASK_READ");
        Task task = findReadableTask(taskId, actorId);
        var predecessors = dependencyRepository.findBySuccessorTaskIdOrderByCreatedAtAsc(taskId).stream()
                .map(dependency -> relatedTask(dependency.getPredecessorTask(), dependency, actorId)).toList();
        var successors = dependencyRepository.findByPredecessorTaskIdOrderByCreatedAtAsc(taskId).stream()
                .map(dependency -> relatedTask(dependency.getSuccessorTask(), dependency, actorId)).toList();
        return new TaskWorkflowDTO(taskMapper.toResponse(task), task.getStatus().nextStatuses(),
                predecessors, successors, taskAccess.canUpdate(task, actorId));
    }

    @Transactional(readOnly = true)
    public List<TaskActivityDTO> getActivity(UUID taskId) {
        Long actorId = taskAccess.requirePermission("TASK_READ");
        findReadableTask(taskId, actorId);
        return auditService.getActivity(taskId);
    }

    public TaskDTO changeStatus(UUID taskId, TaskStatusRequest request, TaskRequestContext context) {
        Long actorId = taskAccess.requirePermission("TASK_UPDATE");
        Task task = findReadableTask(taskId, actorId);
        validateVersion(request.version());
        if (request.status() == null) {
            throw new TaskValidationException("status", "Vui lòng chọn trạng thái");
        }
        String hash = outboxService.requestHash("STATUS_CHANGED", taskId, request);
        var replay = outboxService.findReplay(actorId, context, hash);
        if (replay.isPresent()) return replay.get();

        lockForUpdate(task, actorId, request.version());
        if (!task.getStatus().nextStatuses().contains(request.status())) {
            throw new TaskConflictException("Không thể chuyển trạng thái Task theo bước đã chọn");
        }
        if (request.status() == TaskStatus.IN_PROGRESS || request.status() == TaskStatus.DONE) {
            checkPrerequisitesDone(task);
        }

        TaskDTO before = taskMapper.toResponse(task);
        task.setStatus(request.status());
        return recordChange("STATUS_CHANGED", task, before, actorId, context, hash);
    }

    public TaskDTO addDependency(UUID taskId, TaskDependencyRequest request, TaskRequestContext context) {
        Long actorId = taskAccess.requirePermission("TASK_UPDATE");
        Task task = findReadableTask(taskId, actorId);
        validateVersion(request.version());
        if (request.predecessorTaskId() == null) {
            throw new TaskValidationException("predecessorTaskId", "Vui lòng chọn Task tiền đề");
        }
        String hash = outboxService.requestHash("DEPENDENCY_ADDED", taskId, request);
        var replay = outboxService.findReplay(actorId, context, hash);
        if (replay.isPresent()) return replay.get();

        lockForUpdate(task, actorId, request.version());
        Task predecessor = findLinkedTask(request.predecessorTaskId(), task, actorId);
        if (wouldCreateCycle(taskId, predecessor.getId(), task.getProjectId())) {
            throw new TaskValidationException("predecessorTaskId", "Không thể tạo phụ thuộc vòng (Circular Dependency)");
        }
        TaskDependencyId id = new TaskDependencyId(predecessor.getId(), taskId);
        if (dependencyRepository.existsById(id)) {
            throw new TaskConflictException("Liên kết phụ thuộc đã tồn tại");
        }
        if (task.getStatus() != TaskStatus.TODO && predecessor.getStatus() != TaskStatus.DONE) {
            throw new TaskValidationException("predecessorTaskId",
                    "Task đã bắt đầu, chỉ được thêm Task tiền đề đã hoàn thành");
        }

        TaskDTO before = taskMapper.toResponse(task);
        TaskDependency dependency = dependencyRepository.save(TaskDependency.builder()
                .id(id).predecessorTask(predecessor).successorTask(task).build());
        task.getIncomingDependencies().add(dependency);
        return recordChange("DEPENDENCY_ADDED", task, before, actorId, context, hash);
    }

    public TaskDTO removeDependency(UUID taskId, UUID predecessorId, Long version, TaskRequestContext context) {
        Long actorId = taskAccess.requirePermission("TASK_UPDATE");
        Task task = findReadableTask(taskId, actorId);
        validateVersion(version);
        TaskDependencyRequest request = new TaskDependencyRequest(predecessorId, version);
        String hash = outboxService.requestHash("DEPENDENCY_REMOVED", taskId, request);
        var replay = outboxService.findReplay(actorId, context, hash);
        if (replay.isPresent()) return replay.get();

        lockForUpdate(task, actorId, version);
        findLinkedTask(predecessorId, task, actorId);
        TaskDependencyId id = new TaskDependencyId(predecessorId, taskId);
        TaskDependency dependency = dependencyRepository.findById(id)
                .orElseThrow(this::missingLinkedTask);
        TaskDTO before = taskMapper.toResponse(task);
        task.getIncomingDependencies().removeIf(current -> current.getId().equals(id));
        dependencyRepository.delete(dependency);
        return recordChange("DEPENDENCY_REMOVED", task, before, actorId, context, hash);
    }

    private void lockForUpdate(Task task, Long actorId, Long version) {
        taskRepository.lockProjectTasks(task.getProjectId());
        entityManager.refresh(task);
        if (!Boolean.TRUE.equals(task.getIsActive())) throw missingLinkedTask();
        taskAccess.checkUpdate(task, actorId);
        if (!Objects.equals(task.getVersion(), version)) {
            throw new TaskConflictException(TaskConflictException.STALE_MESSAGE);
        }
    }

    private Task findReadableTask(UUID id, Long actorId) {
        Task task = taskRepository.findByIdAndIsActiveTrue(id).orElseThrow(this::missingLinkedTask);
        taskAccess.checkRead(task, actorId);
        return task;
    }

    private Task findLinkedTask(UUID id, Task task, Long actorId) {
        Task linked = findReadableTask(id, actorId);
        if (!task.getProjectId().equals(linked.getProjectId())) {
            throw new TaskValidationException("predecessorTaskId", "Các Task phụ thuộc phải thuộc cùng Project");
        }
        entityManager.refresh(linked);
        if (!Boolean.TRUE.equals(linked.getIsActive())) throw missingLinkedTask();
        return linked;
    }

    private TaskDependencyDTO relatedTask(Task task, TaskDependency dependency, Long actorId) {
        if (!Boolean.TRUE.equals(task.getIsActive())) throw missingLinkedTask();
        taskAccess.checkRead(task, actorId);
        return new TaskDependencyDTO(task.getId(), task.getTitle(), task.getStatus(),
                dependency.getDependencyType(), dependency.getCreatedAt());
    }

    private boolean wouldCreateCycle(UUID successorId, UUID predecessorId, UUID projectId) {
        Map<UUID, List<UUID>> successors = new HashMap<>();
        for (TaskDependency dependency : dependencyRepository.findBySuccessorTaskProjectId(projectId)) {
            if (Boolean.TRUE.equals(dependency.getPredecessorTask().getIsActive())
                    && Boolean.TRUE.equals(dependency.getSuccessorTask().getIsActive())) {
                successors.computeIfAbsent(dependency.getId().getPredecessorTaskId(), key -> new ArrayList<>())
                        .add(dependency.getId().getSuccessorTaskId());
            }
        }
        Deque<UUID> pending = new ArrayDeque<>();
        Set<UUID> visited = new HashSet<>();
        pending.add(successorId);
        while (!pending.isEmpty()) {
            UUID current = pending.removeFirst();
            if (current.equals(predecessorId)) return true;
            if (visited.add(current)) pending.addAll(successors.getOrDefault(current, List.of()));
        }
        return false;
    }

    private void checkPrerequisitesDone(Task task) {
        for (TaskDependency dependency : dependencyRepository.findBySuccessorTaskIdOrderByCreatedAtAsc(task.getId())) {
            Task predecessor = dependency.getPredecessorTask();
            if (!Boolean.TRUE.equals(predecessor.getIsActive())) throw missingLinkedTask();
            if (predecessor.getStatus() != TaskStatus.DONE) {
                throw new TaskValidationException("status", "Task tiền đề chưa hoàn thành, không thể chuyển trạng thái");
            }
        }
    }

    private TaskDTO recordChange(String action, Task task, TaskDTO before, Long actorId,
                                 TaskRequestContext context, String hash) {
        task.setUpdatedBy(actorId);
        task.setUpdatedAt(LocalDateTime.now());
        taskRepository.saveAndFlush(task);
        TaskDTO after = taskMapper.toResponse(task);
        auditService.record(action, before, after, actorId, context.correlationId());
        outboxService.enqueue("TASK_" + action, after, actorId, context, hash);
        return after;
    }

    private void validateVersion(Long version) {
        if (version == null || version < 0) {
            throw new TaskValidationException("version", "Vui lòng gửi version hiện tại của Task");
        }
    }

    private ResourceNotFoundException missingLinkedTask() {
        return new ResourceNotFoundException("Task liên kết không tồn tại hoặc đã bị xóa");
    }
}
