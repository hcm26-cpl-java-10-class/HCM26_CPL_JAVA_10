package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditService;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxService;
import com.example.starter_project_2025.system.project.task.tag.TaskTagService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {
    private final TaskRepository taskRepository;
    private final TaskMapper taskMapper;
    private final TaskValidator taskValidator;
    private final TaskAccessService taskAccess;
    private final TaskTagService taskTagService;
    private final TaskAuditService taskAuditService;
    private final TaskOutboxService taskOutboxService;
    private final AutoSpecBuilder autoSpecBuilder;

    @Override
    @Transactional(readOnly = true)
    public Page<TaskDTO> getAll(Pageable pageable, String search, TaskFilter filter) {
        Long actorId = taskAccess.requirePermission("TASK_READ");
        requireProjectId(filter.getProjectId());
        Long creatorId = taskAccess.creatorFilter(filter.getProjectId(), actorId);
        validateSort(pageable);

        Specification<Task> spec = autoSpecBuilder.build(filter);
        spec = spec.and((root, query, cb) -> cb.isTrue(root.get("isActive")));
        if (filter.getExcludeIds() != null && !filter.getExcludeIds().isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.not(root.get("id").in(filter.getExcludeIds())));
        }
        if (creatorId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("createdBy"), creatorId));
        }
        if (search != null && !search.isBlank()) {
            String keyword = "%" + search.strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("title")), keyword, '\\'),
                    cb.like(cb.lower(root.get("description")), keyword, '\\')));
        }
        return taskRepository.findAll(spec, pageable).map(taskMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public TaskDTO getById(UUID id) {
        Long actorId = taskAccess.requirePermission("TASK_READ");
        Task task = findTask(id);
        taskAccess.checkRead(task, actorId);
        return taskMapper.toResponse(task);
    }

    @Override
    public TaskDTO create(TaskDTO request, TaskRequestContext context) {
        Long actorId = taskAccess.requirePermission("TASK_CREATE");
        taskValidator.normalizeAndValidate(request, false);
        request.setStatus(TaskStatus.TODO);
        taskAccess.checkProject(request.getProjectId(), actorId);
        taskAccess.checkAssignee(request.getProjectId(), request.getAssigneeProjectMemberId());

        String requestHash = taskOutboxService.requestHash("CREATE", null, request);
        var replay = taskOutboxService.findReplay(actorId, context, requestHash);
        if (replay.isPresent()) {
            return replay.get();
        }

        Task task = taskMapper.toEntity(request);
        task.setStatus(TaskStatus.TODO);
        task.setCreatedBy(actorId);
        task.setUpdatedBy(actorId);
        task.setTags(taskTagService.resolve(task.getProjectId(), request.getTags()));
        taskRepository.saveAndFlush(task);
        return recordChange("CREATE", null, task, actorId, context, requestHash);
    }

    @Override
    public TaskDTO update(UUID id, TaskDTO request, TaskRequestContext context) {
        Long actorId = taskAccess.requirePermission("TASK_UPDATE");
        Task task = findTask(id);
        taskAccess.checkRead(task, actorId);
        taskValidator.normalizeAndValidate(request, true);

        String requestHash = taskOutboxService.requestHash("UPDATE", id, request);
        var replay = taskOutboxService.findReplay(actorId, context, requestHash);
        if (replay.isPresent()) {
            return replay.get();
        }

        taskAccess.checkUpdate(task, actorId);
        if (!Objects.equals(task.getVersion(), request.getVersion())) {
            throw new TaskConflictException(TaskConflictException.STALE_MESSAGE);
        }
        if (!task.getProjectId().equals(request.getProjectId())) {
            throw new TaskValidationException("projectId", "Không thể chuyển Task sang Project khác");
        }
        if (request.getStatus() != null && request.getStatus() != task.getStatus()) {
            throw new TaskConflictException("Không thể đổi trạng thái khi cập nhật thông tin Task");
        }
        taskAccess.checkAssignee(task.getProjectId(), request.getAssigneeProjectMemberId());

        TaskDTO before = taskMapper.toResponse(task);
        taskMapper.update(task, request);
        task.setUpdatedBy(actorId);
        task.setTags(taskTagService.resolve(task.getProjectId(), request.getTags()));
        taskRepository.saveAndFlush(task);
        return recordChange("UPDATE", before, task, actorId, context, requestHash);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getTags(UUID projectId, String search) {
        Long actorId = taskAccess.requirePermission("TASK_READ");
        requireProjectId(projectId);
        Long creatorId = taskAccess.creatorFilter(projectId, actorId);
        return taskTagService.findNames(projectId, creatorId, search);
    }

    private TaskDTO recordChange(String action, TaskDTO before, Task task, Long actorId,
                                 TaskRequestContext context, String requestHash) {
        TaskDTO after = taskMapper.toResponse(task);
        taskAuditService.record(action, before, after, actorId, context.correlationId());
        taskOutboxService.enqueue("TASK_" + ("CREATE".equals(action) ? "CREATED" : "UPDATED"),
                after, actorId, context, requestHash);
        return after;
    }

    private Task findTask(UUID id) {
        return taskRepository.findByIdAndIsActiveTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException("Task không tồn tại hoặc đã bị xóa"));
    }

    private void requireProjectId(UUID projectId) {
        if (projectId == null) {
            throw new TaskValidationException("projectId", "Vui lòng chọn Project");
        }
    }

    private void validateSort(Pageable pageable) {
        Set<String> fields = Set.of("id", "title", "createdAt", "updatedAt", "priority", "status", "estimatedHours");
        for (var order : pageable.getSort()) {
            if (!fields.contains(order.getProperty())) {
                throw new TaskValidationException("sort", "Trường sắp xếp không hợp lệ");
            }
        }
    }
}
