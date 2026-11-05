package com.example.starter_project_2025.system.project.task.workflow;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.audit.TaskActivityDTO;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditService;
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
    private final TaskMapper taskMapper;
    private final TaskAccessService taskAccess;
    private final TaskAuditService auditService;
    private final TaskOutboxService outboxService;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public TaskWorkflowDTO getWorkflow(UUID taskId) {
        Long actorId = taskAccess.requirePermission("TASK_READ");
        Task task = findReadableTask(taskId, actorId);
        return new TaskWorkflowDTO(taskMapper.toResponse(task), task.getStatus().nextStatuses(),
                taskAccess.canUpdate(task, actorId), taskAccess.canDelete(task, actorId));
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
            throw new TaskValidationException("status", "Please select a status");
        }
        String hash = outboxService.requestHash("STATUS_CHANGED", taskId, request);
        var replay = outboxService.findReplay(actorId, context, hash);
        if (replay.isPresent()) return replay.get();

        lockForUpdate(task, actorId, request.version());
        if (!task.getStatus().nextStatuses().contains(request.status())) {
            throw new TaskConflictException("This task status transition is not allowed");
        }


        TaskDTO before = taskMapper.toResponse(task);
        task.setStatus(request.status());
        return recordChange("STATUS_CHANGED", task, before, actorId, context, hash);
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
            throw new TaskValidationException("version", "Please provide the current task version");
        }
    }

    private ResourceNotFoundException missingLinkedTask() {
        return new ResourceNotFoundException("Task does not exist or has been deleted");
    }
}
