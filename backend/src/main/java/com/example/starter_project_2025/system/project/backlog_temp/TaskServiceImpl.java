package com.example.starter_project_2025.system.project.backlog_temp;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.backlog_temp.audit.TaskAuditLogDTO;
import com.example.starter_project_2025.system.project.backlog_temp.audit.TaskAuditService;
import com.example.starter_project_2025.system.project.backlog_temp.event.TaskOutboxService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Backlog item use case implementation for UFR-PRJ-003-02.
 * <p>
 * Business rules covered:
 * <ul>
 *     <li>every item belongs to a project and may only link to a milestone of
 *     that project that still exists and is not cancelled (404, AC03)</li>
 *     <li>title is mandatory, trimmed, 1..250 characters (422, AC02)</li>
 *     <li>description is optional but at most 2000 characters (422, AC02)</li>
 *     <li>estimated hours, when provided, must be &gt;= 0</li>
 *     <li>status follows the workflow Backlog -&gt; Sprint Backlog -&gt;
 *     In Progress -&gt; Done</li>
 *     <li>title is unique inside the same project</li>
 *     <li>every mutation writes an audit log row and a transactional outbox
 *     event for the team (AC01)</li>
 * </ul>
 * The project, sprint and assignee identifiers are owned by other modules and
 * are therefore only carried along, never resolved here.
 */
@Service("backlogItemService")
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TaskServiceImpl
        extends BaseCrudServiceImpl<Task, Long, TaskDTO, TaskFilter>
        implements TaskService {

    static final int MAX_TITLE_LENGTH = 250;
    static final int MAX_DESCRIPTION_LENGTH = 2000;

    static final String PROJECT_FIELD = "projectId";
    static final String SPRINT_FIELD = "sprintId";
    static final String TITLE_FIELD = "title";
    static final String DESCRIPTION_FIELD = "description";
    static final String ESTIMATED_HOURS_FIELD = "estimatedHours";
    static final String STATUS_FIELD = "status";

    static final String ACTION_CREATE = "CREATE";
    static final String ACTION_UPDATE = "UPDATE";
    static final String ACTION_DELETE = "DELETE";

    static final String EVENT_CREATED = "BACKLOG_ITEM_CREATED";
    static final String EVENT_UPDATED = "BACKLOG_ITEM_UPDATED";
    static final String EVENT_DELETED = "BACKLOG_ITEM_DELETED";

    TaskMapper taskMapper;
    TaskRepository taskRepository;
    MilestoneLookup milestoneLookup;
    TaskAuditService taskAuditService;
    TaskOutboxService taskOutboxService;

    @Override
    protected BaseCrudRepository<Task, Long> getRepository() {
        return taskRepository;
    }

    @Override
    protected BaseCrudMapper<Task, TaskDTO> getMapper() {
        return taskMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{TITLE_FIELD, DESCRIPTION_FIELD};
    }

    // ---------------------------------------------------------------------
    // Create (AC01 / AC02 / AC03)
    // ---------------------------------------------------------------------

    @Override
    public TaskDTO create(TaskDTO request) {

        checkPermission(CrudAction.CREATE);

        Task task = taskMapper.toEntity(request);

        task.setTitle(normalizeOptional(task.getTitle()));
        task.setDescription(normalizeOptional(task.getDescription()));

        if (task.getStatus() == null) {
            task.setStatus(TaskStatus.BACKLOG);
        }

        if (task.getPriority() == null) {
            task.setPriority(TaskPriority.MEDIUM);
        }

        if (task.getIsActive() == null) {
            task.setIsActive(true);
        }

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateProject(task.getProjectId(), errors);
        validateTitle(task.getTitle(), errors);
        validateDescription(task.getDescription(), errors);
        validateEstimatedHours(task.getEstimatedHours(), errors);
        validateInitialStatus(task.getStatus(), task.getSprintId(), errors);

        throwIfInvalid(errors);

        // AC03: the milestone must exist, belong to the project and still be usable.
        milestoneLookup.requireLinkable(task.getMilestoneId(), task.getProjectId());

        validateTitleUnique(task.getProjectId(), task.getTitle(), null, errors);
        throwIfInvalid(errors);

        Task saved = taskRepository.save(task);

        Map<String, Object> after = snapshot(saved);

        taskAuditService.record(ACTION_CREATE, saved.getId(), saved.getProjectId(), null, after);
        taskOutboxService.enqueue(EVENT_CREATED, saved.getId(), saved.getProjectId(), currentActorEmail(), after);

        return taskMapper.toResponse(saved);
    }

    // ---------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------

    /**
     * Overridden so the "before" snapshot is taken before the entity is
     * mutated: the base implementation would lose it, which would break the
     * audit trail required by the user story.
     */
    @Override
    public TaskDTO update(Long id, TaskDTO request) {

        checkPermission(CrudAction.UPDATE);

        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Backlog item", "id", id));

        String title = request.getTitle() != null
                ? normalizeOptional(request.getTitle())
                : task.getTitle();
        String description = request.getDescription() != null
                ? normalizeOptional(request.getDescription())
                : task.getDescription();
        Long projectId = request.getProjectId() != null ? request.getProjectId() : task.getProjectId();
        Long sprintId = request.getSprintId() != null ? request.getSprintId() : task.getSprintId();
        Long milestoneId = request.getMilestoneId() != null ? request.getMilestoneId() : task.getMilestoneId();
        Double estimatedHours = request.getEstimatedHours() != null
                ? request.getEstimatedHours()
                : task.getEstimatedHours();
        TaskStatus status = request.getStatus() != null ? request.getStatus() : task.getStatus();

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateProject(projectId, errors);
        validateTitle(title, errors);
        validateDescription(description, errors);
        validateEstimatedHours(estimatedHours, errors);
        validateTransition(task.getStatus(), status, errors);
        validateSprintRequirement(status, sprintId, errors);

        throwIfInvalid(errors);

        milestoneLookup.requireLinkable(milestoneId, projectId);

        validateTitleUnique(projectId, title, task.getId(), errors);
        throwIfInvalid(errors);

        Map<String, Object> before = snapshot(task);

        task.setProjectId(projectId);
        task.setSprintId(sprintId);
        task.setMilestoneId(milestoneId);
        task.setTitle(title);
        task.setDescription(description);
        task.setEstimatedHours(estimatedHours);
        task.setStatus(status);

        if (request.getPriority() != null) {
            task.setPriority(request.getPriority());
        }

        if (request.getAssigneeProjectMemberId() != null) {
            task.setAssigneeProjectMemberId(request.getAssigneeProjectMemberId());
        }

        if (request.getIsActive() != null) {
            task.setIsActive(request.getIsActive());
        }

        Task saved = taskRepository.save(task);

        Map<String, Object> after = snapshot(saved);

        taskAuditService.record(ACTION_UPDATE, saved.getId(), saved.getProjectId(), before, after);
        taskOutboxService.enqueue(EVENT_UPDATED, saved.getId(), saved.getProjectId(), currentActorEmail(), after);

        return taskMapper.toResponse(saved);
    }

    // ---------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------

    @Override
    public void delete(Long id) {

        checkPermission(CrudAction.DELETE);

        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Backlog item", "id", id));

        Map<String, Object> before = snapshot(task);
        Long projectId = task.getProjectId();

        taskAuditService.record(ACTION_DELETE, id, projectId, before, null);
        taskOutboxService.enqueue(EVENT_DELETED, id, projectId, currentActorEmail(), before);

        taskRepository.delete(task);
    }

    // ---------------------------------------------------------------------
    // Audit query
    // ---------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<TaskAuditLogDTO> getAuditLogs(Long taskId) {

        check("TASK_READ");

        taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Backlog item", "id", taskId));

        return taskAuditService.getAuditLogs(taskId);
    }

    // ---------------------------------------------------------------------
    // Normalization
    // ---------------------------------------------------------------------

    private String normalizeOptional(String value) {

        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    // ---------------------------------------------------------------------
    // Validation
    // ---------------------------------------------------------------------

    private void validateProject(Long projectId, Map<String, List<String>> errors) {

        if (projectId == null) {
            errors.put(PROJECT_FIELD, List.of("Vui lòng chọn dự án cho Backlog item"));
        }
    }

    private void validateTitle(String title, Map<String, List<String>> errors) {

        if (title == null || title.isBlank()) {
            errors.put(TITLE_FIELD, List.of("Vui lòng nhập tên Backlog item"));
            return;
        }

        if (title.length() > MAX_TITLE_LENGTH) {
            errors.put(TITLE_FIELD, List.of("Tên Backlog item không vượt quá " + MAX_TITLE_LENGTH + " ký tự"));
        }
    }

    private void validateDescription(String description, Map<String, List<String>> errors) {

        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            errors.put(DESCRIPTION_FIELD, List.of("Mô tả không được vượt quá " + MAX_DESCRIPTION_LENGTH + " ký tự"));
        }
    }

    private void validateEstimatedHours(Double estimatedHours, Map<String, List<String>> errors) {

        if (estimatedHours != null && estimatedHours < 0) {
            errors.put(ESTIMATED_HOURS_FIELD, List.of("Số giờ ước tính phải lớn hơn hoặc bằng 0"));
        }
    }

    /**
     * A brand new item may only start in the product backlog, or directly in a
     * sprint backlog when a sprint was selected.
     */
    private void validateInitialStatus(TaskStatus status,
                                       Long sprintId,
                                       Map<String, List<String>> errors) {

        if (status == null) {
            return;
        }

        if (!status.isInitialStage()) {
            errors.put(STATUS_FIELD, List.of(
                    "Backlog item mới chỉ có thể ở trạng thái Backlog hoặc Sprint Backlog"));
            return;
        }

        validateSprintRequirement(status, sprintId, errors);
    }

    private void validateSprintRequirement(TaskStatus status,
                                           Long sprintId,
                                           Map<String, List<String>> errors) {

        if (status == TaskStatus.SPRINT_BACKLOG && sprintId == null) {
            errors.put(SPRINT_FIELD, List.of("Vui lòng chọn Sprint khi chuyển sang Sprint Backlog"));
        }
    }

    /**
     * Workflow guard of UFR-PRJ-003-02: Backlog -&gt; Sprint Backlog -&gt;
     * In Progress -&gt; Done, one step at a time.
     */
    private void validateTransition(TaskStatus current,
                                    TaskStatus target,
                                    Map<String, List<String>> errors) {

        if (target == null || current == null) {
            return;
        }

        if (!current.canTransitionTo(target)) {
            errors.put(STATUS_FIELD, List.of(
                    "Không thể chuyển trạng thái từ " + current.getLabel()
                            + " sang " + target.getLabel()
                            + ". Workflow: " + TaskStatus.workflow()));
        }
    }

    private void validateTitleUnique(Long projectId,
                                     String title,
                                     Long currentId,
                                     Map<String, List<String>> errors) {

        if (projectId == null || title == null) {
            return;
        }

        Optional<Task> existing = taskRepository.findByProjectIdAndTitleIgnoreCase(projectId, title);

        if (existing.isPresent()
                && (currentId == null || !existing.get().getId().equals(currentId))) {

            errors.put(TITLE_FIELD, List.of("Backlog item với tên này đã tồn tại trong dự án"));
        }
    }

    private void throwIfInvalid(Map<String, List<String>> errors) {

        if (!errors.isEmpty()) {
            throw new TaskValidationException(errors);
        }
    }

    // ---------------------------------------------------------------------
    // Audit / outbox helpers
    // ---------------------------------------------------------------------

    private Map<String, Object> snapshot(Task task) {

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", task.getId());
        snapshot.put("projectId", task.getProjectId());
        snapshot.put("sprintId", task.getSprintId());
        snapshot.put("milestoneId", task.getMilestoneId());
        snapshot.put("assigneeProjectMemberId", task.getAssigneeProjectMemberId());
        snapshot.put("title", task.getTitle());
        snapshot.put("description", task.getDescription());
        snapshot.put("estimatedHours", task.getEstimatedHours());
        snapshot.put("priority", task.getPriority());
        snapshot.put("status", task.getStatus());
        snapshot.put("isActive", task.getIsActive());

        return snapshot;
    }

    private String currentActorEmail() {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        if (authentication.getPrincipal() instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getUsername();
        }

        return authentication.getName();
    }
}
