package com.example.starter_project_2025.system.project.task.deletion;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditService;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class TaskDeletionService {
    private final TaskRepository taskRepository;
    private final TaskMapper taskMapper;
    private final TaskAccessService taskAccess;
    private final TaskAuditService auditService;
    private final TaskOutboxService outboxService;
    private final ObjectProvider<TaskArtifactAccess> artifactAccessProvider;
    private final EntityManager entityManager;

    public TaskDTO delete(UUID taskId, Long version, TaskRequestContext context) {
        Long actorId = taskAccess.requirePermission("TASK_DELETE");
        Task task = taskRepository.findById(taskId).orElseThrow(this::missingTask);
        taskAccess.checkDelete(task, actorId);
        if (version == null || version < 0) {
            throw new TaskValidationException("version", "Please provide the current task version");
        }
        String hash = outboxService.requestHash("DELETE", taskId, Map.of("version", version));
        var replay = outboxService.findReplay(actorId, context, hash);
        if (replay.isPresent()) return replay.get();

        UUID projectId = task.getProjectId();
        entityManager.detach(task);
        taskRepository.lockProjectTasks(projectId);
        task = taskRepository.findById(taskId).orElseThrow(this::missingTask);
        entityManager.refresh(task);
        taskAccess.checkDelete(task, actorId);
        replay = outboxService.findReplay(actorId, context, hash);
        if (replay.isPresent()) return replay.get();
        if (!Boolean.TRUE.equals(task.getIsActive())) throw missingTask();
        if (!Objects.equals(task.getVersion(), version)) {
            throw new TaskConflictException(TaskConflictException.STALE_MESSAGE);
        }
        validateDeletion(task);

        TaskDTO before = taskMapper.toResponse(task);
        task.setIsActive(false);
        task.setUpdatedBy(actorId);
        task.setUpdatedAt(LocalDateTime.now());
        taskRepository.saveAndFlush(task);
        TaskDTO after = taskMapper.toResponse(task);
        auditService.record("DELETE", before, after, actorId, context.correlationId());
        outboxService.enqueue("TASK_DELETED", after, actorId, context, hash);
        return after;
    }

    private void validateDeletion(Task task) {
        if (task.getStatus() != TaskStatus.TODO && task.getStatus() != TaskStatus.IN_PROGRESS) {
            throw new TaskValidationException("status", "Only tasks in To Do or In Progress can be deleted");
        }
        TaskArtifactAccess access = artifactAccessProvider.getIfAvailable();
        if (access != null && access.hasArtifactOrReview(task.getId())) {
            throw new TaskValidationException("artifact",
                    "Tasks linked to an artifact or review cannot be deleted");
        }
    }

    private ResourceNotFoundException missingTask() {
        return new ResourceNotFoundException("Task does not exist or has been deleted");
    }
}
