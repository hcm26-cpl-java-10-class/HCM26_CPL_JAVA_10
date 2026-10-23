package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.backlog_temp.Milestone;
import com.example.starter_project_2025.system.project.backlog_temp.MilestoneRepository;
import com.example.starter_project_2025.system.project.backlog_temp.Task;
import com.example.starter_project_2025.system.project.backlog_temp.TaskPriority;
import com.example.starter_project_2025.system.project.backlog_temp.TaskRepository;
import com.example.starter_project_2025.system.project.backlog_temp.TaskStatus;
import com.example.starter_project_2025.system.project.sprint.audit.SprintAuditLogDTO;
import com.example.starter_project_2025.system.project.sprint.audit.SprintAuditService;
import com.example.starter_project_2025.system.project.sprint.event.SprintOutboxService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Sprint use case implementation for UFR-PRJ-003-01.
 * <p>
 * Business rules covered:
 * <ul>
 *     <li>start date &lt; end date (422)</li>
 *     <li>sprint name unique (409)</li>
 *     <li>sprint goal 1..500 characters (422)</li>
 *     <li>a new sprint can only be Planned or Active</li>
 *     <li>audit log (actor, timestamp, before/after, correlation id) + outbox event (idempotent)</li>
 * </ul>
 * <p>
 * The project relationship is intentionally not used: the project module is
 * owned by another team, so {@code projectId} is only carried along (when
 * provided) and never validated or resolved here.
 */
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintServiceImpl
        extends BaseCrudServiceImpl<Sprint, Long, SprintDTO, SprintFilter>
        implements SprintService {

    static final int MAX_NAME_LENGTH = 255;
    static final int MAX_GOAL_LENGTH = 500;

    static final String NAME_FIELD = "name";
    static final String GOAL_FIELD = "sprintGoal";
    static final String START_DATE_FIELD = "startDate";
    static final String END_DATE_FIELD = "endDate";
    static final String STATUS_FIELD = "status";

    static final String EVENT_CREATED = "SPRINT_CREATED";
    static final String EVENT_UPDATED = "SPRINT_UPDATED";
    static final String EVENT_DELETED = "SPRINT_DELETED";
    static final String EVENT_BACKLOG_UPDATED = "SPRINT_BACKLOG_UPDATED";

    static final String ACTION_BACKLOG_UPDATED = "BACKLOG_UPDATED";

    static final String TASK_IDS_FIELD = "taskIds";
    static final String SCOPE_LOCKED_MESSAGE =
            "Không thể thay đổi phạm vi công việc do Sprint đã hoàn thành/đã đóng";

    SprintMapper sprintMapper;
    SprintRepository sprintRepository;
    SprintAuditService sprintAuditService;
    SprintOutboxService sprintOutboxService;
    TaskRepository taskRepository;
    MilestoneRepository milestoneRepository;

    @Override
    protected BaseCrudRepository<Sprint, Long> getRepository() {
        return sprintRepository;
    }

    @Override
    protected BaseCrudMapper<Sprint, SprintDTO> getMapper() {
        return sprintMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"name", "sprintGoal"};
    }

    // ---------------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------------

    @Override
    protected void beforeCreate(Sprint sprint, SprintDTO request, ValidationContext ctx) {

        normalize(sprint);

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateName(sprint.getName(), errors);
        validateGoal(sprint.getSprintGoal(), errors);
        validateDates(sprint.getStartDate(), sprint.getEndDate(), errors);
        validateCreateStatus(sprint.getStatus(), errors);

        throwIfInvalid(errors);

        ensureUniqueName(sprint.getName(), null);

        if (sprint.getStatus() == null) {
            sprint.setStatus(SprintStatus.PLANNED);
        }

        if (sprint.getIsActive() == null) {
            sprint.setIsActive(true);
        }
    }

    @Override
    protected void afterCreate(Sprint saved, SprintDTO request) {

        Map<String, Object> after = snapshot(saved);
        Long projectId = saved.getProjectId();

        sprintAuditService.record("CREATE", saved.getId(), projectId, null, after);
        sprintOutboxService.enqueue(EVENT_CREATED, saved.getId(), projectId, currentActorEmail(), after);
    }

    // ---------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------

    /**
     * Overridden to keep full control over the audit trail: the base
     * implementation would lose the "before" snapshot once the entity has been
     * mutated.
     */
    @Override
    public SprintDTO update(Long id, SprintDTO request) {

        checkPermission(CrudAction.UPDATE);

        Sprint sprint = sprintRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint", "id", id));

        String name = request.getName() != null ? request.getName().trim() : sprint.getName();
        String goal = request.getSprintGoal() != null ? request.getSprintGoal().trim() : sprint.getSprintGoal();
        LocalDateTime startDate = request.getStartDate() != null ? request.getStartDate() : sprint.getStartDate();
        LocalDateTime endDate = request.getEndDate() != null ? request.getEndDate() : sprint.getEndDate();

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateName(name, errors);
        validateGoal(goal, errors);
        validateDates(startDate, endDate, errors);

        throwIfInvalid(errors);

        if (request.getName() != null) {
            ensureUniqueName(name, sprint.getId());
        }

        Map<String, Object> before = snapshot(sprint);

        request.setName(name);
        request.setSprintGoal(goal);

        sprintMapper.update(sprint, request);

        Sprint saved = sprintRepository.save(sprint);

        Map<String, Object> after = snapshot(saved);
        Long projectId = saved.getProjectId();

        sprintAuditService.record("UPDATE", saved.getId(), projectId, before, after);
        sprintOutboxService.enqueue(EVENT_UPDATED, saved.getId(), projectId, currentActorEmail(), after);

        return sprintMapper.toResponse(saved);
    }

    // ---------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------

    @Override
    public void delete(Long id) {

        checkPermission(CrudAction.DELETE);

        Sprint sprint = sprintRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint", "id", id));

        Map<String, Object> before = snapshot(sprint);
        Long projectId = sprint.getProjectId();

        sprintAuditService.record("DELETE", id, projectId, before, null);
        sprintOutboxService.enqueue(EVENT_DELETED, id, projectId, currentActorEmail(), before);

        sprintRepository.delete(sprint);
    }

    // ---------------------------------------------------------------------
    // Audit query
    // ---------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<SprintAuditLogDTO> getAuditLogs(Long sprintId) {

        check("SPRINT_READ");

        sprintRepository.findById(sprintId)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint", "id", sprintId));

        return sprintAuditService.getAuditLogs(sprintId);
    }

    /**
     * Materialises sprint rows into flat export rows inside the transaction so
     * the generic exporter never touches a lazy association.
     */
    @Override
    @Transactional(readOnly = true)
    public List<SprintExportRow> getExportRows() {

        check("SPRINT_READ");

        return sprintRepository.findAll()
                .stream()
                .map(SprintExportRow::from)
                .toList();
    }

    // ---------------------------------------------------------------------
    // Sprint Planning (UFR-PRJ-003-03)
    // ---------------------------------------------------------------------

    /**
     * Builds the two panels of the planning board. The sprint backlog is
     * returned in its persisted priority order, while the product backlog is
     * sorted by priority so the most valuable items are picked first.
     */
    @Override
    @Transactional(readOnly = true)
    public SprintPlanningDTO getPlanning(Long sprintId) {

        check("SPRINT_READ");

        Sprint sprint = findSprint(sprintId);

        check("TASK_READ");

        return buildPlanning(sprint);
    }

    /**
     * Applies the whole planning board in one transaction (AC01 / AC02 / AC03):
     * <ul>
     *     <li>items listed in {@code taskIds} are assigned to the sprint, in the
     *     given order (priority order);</li>
     *     <li>items currently in the sprint but missing from the list are moved
     *     back to the product backlog;</li>
     *     <li>a completed / cancelled sprint rejects the change with 422 so the
     *     UI can revert the drag &amp; drop position.</li>
     * </ul>
     * One audit row and one outbox event are written for the whole operation.
     */
    @Override
    public SprintPlanningDTO saveSprintBacklog(Long sprintId, SprintBacklogPlanDTO request) {

        check("SPRINT_UPDATE");
        check("TASK_UPDATE");

        Sprint sprint = findSprint(sprintId);

        Map<String, List<String>> errors = new LinkedHashMap<>();

        // AC02: a sprint that is already closed keeps its backlog frozen.
        if (!isScopeEditable(sprint)) {
            addError(errors, STATUS_FIELD, scopeLockedMessage(sprint));
        }

        List<Long> orderedIds = distinctTaskIds(request, errors);

        throwIfInvalid(errors);

        List<Task> currentSprintTasks =
                taskRepository.findBySprintIdOrderBySprintOrderAscIdAsc(sprintId);
        List<Task> requestedTasks = resolveRequestedTasks(orderedIds, errors);

        validateAssignable(sprint, requestedTasks, errors);
        validateUnassignable(currentSprintTasks, orderedIds, errors);

        throwIfInvalid(errors);

        Map<String, Object> before = planningSnapshot(sprintId, currentSprintTasks);

        applyPlan(sprintId, orderedIds, requestedTasks, currentSprintTasks);

        taskRepository.flush();

        List<Task> savedTasks =
                taskRepository.findBySprintIdOrderBySprintOrderAscIdAsc(sprintId);
        Map<String, Object> after = planningSnapshot(sprintId, savedTasks);

        if (!before.get("taskIds").equals(after.get("taskIds"))) {
            recordPlanningChange(sprint, orderedIds, currentSprintTasks, before, after);
        }

        return buildPlanning(sprint);
    }

    private Sprint findSprint(Long sprintId) {

        return sprintRepository.findById(sprintId)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint", "id", sprintId));
    }

    private boolean isScopeEditable(Sprint sprint) {

        return sprint.getStatus() == SprintStatus.PLANNED
                || sprint.getStatus() == SprintStatus.ACTIVE;
    }

    private String scopeLockedMessage(Sprint sprint) {

        if (sprint.getStatus() == SprintStatus.CANCELLED) {
            return "Không thể thay đổi phạm vi công việc do Sprint đã bị hủy";
        }

        return SCOPE_LOCKED_MESSAGE;
    }

    /**
     * Validates the shape of the request and removes duplicated ids while
     * keeping the order chosen by the user.
     */
    private List<Long> distinctTaskIds(SprintBacklogPlanDTO request,
                                       Map<String, List<String>> errors) {

        if (request == null || request.getTaskIds() == null) {
            addError(errors, TASK_IDS_FIELD,
                    "Danh sách Backlog item của Sprint Backlog không hợp lệ");
            return List.of();
        }

        List<Long> orderedIds = new ArrayList<>();
        Set<Long> seen = new HashSet<>();

        for (Long taskId : request.getTaskIds()) {

            if (taskId == null) {
                addError(errors, TASK_IDS_FIELD, "Backlog item không hợp lệ");
                continue;
            }

            if (!seen.add(taskId)) {
                addError(errors, TASK_IDS_FIELD,
                        "Danh sách Sprint Backlog chứa Backlog item bị trùng");
                continue;
            }

            orderedIds.add(taskId);
        }

        return orderedIds;
    }

    private List<Task> resolveRequestedTasks(List<Long> orderedIds,
                                             Map<String, List<String>> errors) {

        if (orderedIds.isEmpty()) {
            return List.of();
        }

        Map<Long, Task> tasksById = taskRepository.findAllById(orderedIds)
                .stream()
                .collect(Collectors.toMap(Task::getId, Function.identity()));

        List<Task> ordered = new ArrayList<>();

        for (Long taskId : orderedIds) {

            Task task = tasksById.get(taskId);

            if (task == null) {
                addError(errors, TASK_IDS_FIELD,
                        "Backlog item #" + taskId + " không tồn tại hoặc đã bị xoá");
                continue;
            }

            ordered.add(task);
        }

        return ordered;
    }

    /**
     * AC01 / business rule "Tương thích Milestone": every item that enters the
     * sprint must belong to the same project, still be workable and stay inside
     * the deadline of the milestone it is linked to.
     */
    private void validateAssignable(Sprint sprint,
                                    List<Task> requestedTasks,
                                    Map<String, List<String>> errors) {

        Long sprintId = sprint.getId();
        Long sprintProjectId = sprint.getProjectId();

        for (Task task : requestedTasks) {

            String label = displayName(task);

            if (task.getSprintId() != null && !task.getSprintId().equals(sprintId)) {
                addError(errors, TASK_IDS_FIELD, label + " đã thuộc một Sprint khác");
                continue;
            }

            if (task.getStatus() == TaskStatus.IN_PROGRESS || task.getStatus() == TaskStatus.DONE) {
                addError(errors, TASK_IDS_FIELD,
                        label + " đang ở trạng thái " + task.getStatus().getLabel()
                                + " nên không thể gán vào Sprint");
                continue;
            }

            if (sprintProjectId != null
                    && task.getProjectId() != null
                    && !sprintProjectId.equals(task.getProjectId())) {
                addError(errors, TASK_IDS_FIELD, label + " thuộc dự án khác với Sprint");
                continue;
            }

            validateMilestoneCompatibility(sprint, task, label, errors);
        }
    }

    private void validateMilestoneCompatibility(Sprint sprint,
                                                Task task,
                                                String label,
                                                Map<String, List<String>> errors) {

        if (task.getMilestoneId() == null) {
            return;
        }

        Milestone milestone = milestoneRepository.findById(task.getMilestoneId()).orElse(null);

        if (milestone == null
                || !milestone.isLinkable()
                || (task.getProjectId() != null
                && !task.getProjectId().equals(milestone.getProjectId()))) {

            addError(errors, TASK_IDS_FIELD,
                    label + " đang liên kết tới Milestone không còn hiệu lực");
            return;
        }

        LocalDate sprintEnd = sprint.getEndDate() != null
                ? sprint.getEndDate().toLocalDate()
                : null;

        if (sprintEnd != null
                && milestone.getDueDate() != null
                && sprintEnd.isAfter(milestone.getDueDate())) {

            addError(errors, TASK_IDS_FIELD,
                    label + " không tương thích Milestone \"" + milestone.getName()
                            + "\" (hạn chót " + milestone.getDueDate()
                            + " trước ngày kết thúc Sprint " + sprintEnd + ")");
        }
    }

    /**
     * Items that are already in progress or done cannot leave the sprint.
     */
    private void validateUnassignable(List<Task> currentSprintTasks,
                                      List<Long> orderedIds,
                                      Map<String, List<String>> errors) {

        Set<Long> keep = new HashSet<>(orderedIds);

        for (Task task : currentSprintTasks) {

            if (keep.contains(task.getId())) {
                continue;
            }

            if (task.getStatus() == TaskStatus.IN_PROGRESS || task.getStatus() == TaskStatus.DONE) {
                addError(errors, TASK_IDS_FIELD,
                        displayName(task) + " đang ở trạng thái " + task.getStatus().getLabel()
                                + " nên không thể hủy gán khỏi Sprint");
            }
        }
    }

    private void applyPlan(Long sprintId,
                           List<Long> orderedIds,
                           List<Task> requestedTasks,
                           List<Task> currentSprintTasks) {

        Map<Long, Task> requestedById = requestedTasks.stream()
                .collect(Collectors.toMap(Task::getId, Function.identity()));

        for (int index = 0; index < orderedIds.size(); index++) {

            Task task = requestedById.get(orderedIds.get(index));

            if (task == null) {
                continue;
            }

            task.setSprintId(sprintId);
            task.setSprintOrder(index + 1);

            if (task.getStatus() == null || task.getStatus() == TaskStatus.BACKLOG) {
                task.setStatus(TaskStatus.SPRINT_BACKLOG);
            }
        }

        taskRepository.saveAll(requestedById.values());

        Set<Long> keep = new HashSet<>(orderedIds);
        List<Task> removed = new ArrayList<>();

        for (Task task : currentSprintTasks) {

            if (keep.contains(task.getId())) {
                continue;
            }

            task.setSprintId(null);
            task.setSprintOrder(null);

            if (task.getStatus() == TaskStatus.SPRINT_BACKLOG) {
                task.setStatus(TaskStatus.BACKLOG);
            }

            removed.add(task);
        }

        taskRepository.saveAll(removed);
    }

    private void recordPlanningChange(Sprint sprint,
                                      List<Long> orderedIds,
                                      List<Task> currentSprintTasks,
                                      Map<String, Object> before,
                                      Map<String, Object> after) {

        Set<Long> beforeIds = currentSprintTasks.stream()
                .map(Task::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> afterIds = new LinkedHashSet<>(orderedIds);

        List<Long> addedTaskIds = orderedIds.stream()
                .filter(taskId -> !beforeIds.contains(taskId))
                .toList();
        List<Long> removedTaskIds = beforeIds.stream()
                .filter(taskId -> !afterIds.contains(taskId))
                .toList();

        long currentSprintId = sprint.getId();

        sprintAuditService.record(
                ACTION_BACKLOG_UPDATED,
                currentSprintId,
                sprint.getProjectId(),
                before,
                after
        );

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sprintId", currentSprintId);
        payload.put("sprintName", sprint.getName());
        payload.put("taskIds", orderedIds);
        payload.put("addedTaskIds", addedTaskIds);
        payload.put("removedTaskIds", removedTaskIds);

        sprintOutboxService.enqueue(
                EVENT_BACKLOG_UPDATED,
                currentSprintId,
                sprint.getProjectId(),
                currentActorEmail(),
                payload
        );
    }

    private SprintPlanningDTO buildPlanning(Sprint sprint) {

        List<Task> sprintItems =
                taskRepository.findBySprintIdOrderBySprintOrderAscIdAsc(sprint.getId());
        List<Task> productItems = loadProductBacklog(sprint);

        Map<Long, Milestone> milestones = loadMilestones(sprintItems, productItems);

        boolean canPlan = isScopeEditable(sprint);

        return new SprintPlanningDTO(
                sprint.getId(),
                sprint.getName(),
                sprint.getSprintGoal(),
                sprint.getStatus(),
                sprint.getStartDate(),
                sprint.getEndDate(),
                sprint.getProjectId(),
                canPlan,
                canPlan ? null : scopeLockedMessage(sprint),
                sprintItems.stream()
                        .map(task -> toPlanningItem(task, milestones))
                        .toList(),
                productItems.stream()
                        .map(task -> toPlanningItem(task, milestones))
                        .toList()
        );
    }

    /**
     * {@code Map.of()} rejects a {@code null} key lookup, so the milestone is
     * only resolved when the item is actually linked to one.
     */
    private SprintPlanningItemDTO toPlanningItem(Task task,
                                                 Map<Long, Milestone> milestones) {

        Milestone milestone = task.getMilestoneId() != null
                ? milestones.get(task.getMilestoneId())
                : null;

        return SprintPlanningItemDTO.from(task, milestone);
    }

    /**
     * Items that are still in the product backlog of the sprint's project.
     * Nothing is filtered out by priority: the student decides.
     */
    private List<Task> loadProductBacklog(Sprint sprint) {

        List<Task> candidates = sprint.getProjectId() != null
                ? taskRepository.findByProjectIdAndSprintIdIsNull(sprint.getProjectId())
                : taskRepository.findBySprintIdIsNull();

        return candidates.stream()
                .filter(task -> task.getStatus() == null
                        || task.getStatus() == TaskStatus.BACKLOG
                        || task.getStatus() == TaskStatus.SPRINT_BACKLOG)
                .sorted(productBacklogComparator())
                .toList();
    }

    private Comparator<Task> productBacklogComparator() {

        return Comparator
                .comparingInt((Task task) -> priorityRank(task.getPriority()))
                .reversed()
                .thenComparing(Task::getTitle, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                .thenComparing(Task::getId, Comparator.nullsLast(Long::compareTo));
    }

    private int priorityRank(TaskPriority priority) {

        return priority == null ? -1 : priority.ordinal();
    }

    private Map<Long, Milestone> loadMilestones(List<Task>... groups) {

        Set<Long> milestoneIds = new HashSet<>();

        for (List<Task> group : groups) {
            for (Task task : group) {
                if (task.getMilestoneId() != null) {
                    milestoneIds.add(task.getMilestoneId());
                }
            }
        }

        if (milestoneIds.isEmpty()) {
            return Map.of();
        }

        return milestoneRepository.findAllById(milestoneIds)
                .stream()
                .collect(Collectors.toMap(Milestone::getId, Function.identity()));
    }

    private Map<String, Object> planningSnapshot(Long sprintId, List<Task> tasks) {

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("sprintId", sprintId);
        snapshot.put("taskIds", tasks.stream().map(Task::getId).toList());

        return snapshot;
    }

    private String displayName(Task task) {

        if (task.getTitle() != null && !task.getTitle().isBlank()) {
            return "\"" + task.getTitle() + "\"";
        }

        return "Backlog item #" + task.getId();
    }

    private void addError(Map<String, List<String>> errors, String field, String message) {

        errors.computeIfAbsent(field, key -> new ArrayList<>()).add(message);
    }

    // ---------------------------------------------------------------------
    // Validation helpers
    // ---------------------------------------------------------------------

    private void validateName(String name, Map<String, List<String>> errors) {

        if (name == null || name.isBlank()) {
            errors.put(NAME_FIELD, List.of("Vui lòng nhập tên Sprint"));
            return;
        }

        if (name.length() > MAX_NAME_LENGTH) {
            errors.put(NAME_FIELD, List.of("Tên Sprint không vượt quá " + MAX_NAME_LENGTH + " ký tự"));
        }
    }

    private void validateGoal(String goal, Map<String, List<String>> errors) {

        if (goal == null || goal.isBlank()) {
            errors.put(GOAL_FIELD, List.of("Vui lòng nhập mục tiêu Sprint"));
            return;
        }

        if (goal.length() > MAX_GOAL_LENGTH) {
            errors.put(GOAL_FIELD, List.of("Mục tiêu sprint không vượt quá " + MAX_GOAL_LENGTH + " ký tự"));
        }
    }

    private void validateDates(LocalDateTime startDate,
                               LocalDateTime endDate,
                               Map<String, List<String>> errors) {

        if (startDate == null) {
            errors.put(START_DATE_FIELD, List.of("Vui lòng chọn thời gian bắt đầu"));
        }

        if (endDate == null) {
            errors.put(END_DATE_FIELD, List.of("Vui lòng chọn thời gian kết thúc"));
        }

        if (startDate != null && endDate != null && !startDate.isBefore(endDate)) {
            errors.put(END_DATE_FIELD, List.of("Thời gian kết thúc phải sau thời gian bắt đầu"));
        }
    }

    private void validateCreateStatus(SprintStatus status, Map<String, List<String>> errors) {

        if (status == null) {
            return;
        }

        if (status != SprintStatus.PLANNED && status != SprintStatus.ACTIVE) {
            errors.put(STATUS_FIELD, List.of("Sprint mới chỉ có thể ở trạng thái Planned hoặc Active"));
        }
    }

    private void ensureUniqueName(String name, Long excludedId) {

        boolean exists = excludedId == null
                ? sprintRepository.existsByName(name)
                : sprintRepository.existsByNameAndIdNot(name, excludedId);

        if (exists) {
            throw SprintConflictException.duplicateName();
        }
    }

    private void throwIfInvalid(Map<String, List<String>> errors) {

        if (!errors.isEmpty()) {
            throw new SprintValidationException(errors);
        }
    }

    private void normalize(Sprint sprint) {

        if (sprint.getName() != null) {
            sprint.setName(sprint.getName().trim());
        }

        if (sprint.getSprintGoal() != null) {
            sprint.setSprintGoal(sprint.getSprintGoal().trim());
        }
    }

    // ---------------------------------------------------------------------
    // Audit / outbox helpers
    // ---------------------------------------------------------------------

    private Map<String, Object> snapshot(Sprint sprint) {

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", sprint.getId());
        snapshot.put("projectId", sprint.getProjectId());
        snapshot.put("name", sprint.getName());
        snapshot.put("sprintGoal", sprint.getSprintGoal());
        snapshot.put("startDate", sprint.getStartDate());
        snapshot.put("endDate", sprint.getEndDate());
        snapshot.put("status", sprint.getStatus());
        snapshot.put("isActive", sprint.getIsActive());
        snapshot.put("version", sprint.getVersion());

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
