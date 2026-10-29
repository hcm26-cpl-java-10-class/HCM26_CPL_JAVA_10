package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.sprint.audit.SprintAuditLogDTO;
import com.example.starter_project_2025.system.project.sprint.audit.SprintAuditService;
import com.example.starter_project_2025.system.project.sprint.event.SprintOutboxService;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
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
 *     <li>a new sprint always starts as Planned (the client cannot pick another
 *     status)</li>
 *     <li>an existing Planned sprint can only move to Active or Cancelled; an
 *     Active sprint can only move to Completed or Cancelled (422 otherwise)</li>
 *     <li>a sprint can only be started (Active) when it holds at least one
 *     Sprint Backlog item (422 otherwise)</li>
 *     <li>a sprint can only move to Completed once every Sprint Backlog item of
 *     that sprint is Done (422 otherwise)</li>
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

    static final String BACKLOG_IDS_FIELD = "taskIds";
    static final String SCOPE_LOCKED_MESSAGE =
            "Không thể thay đổi phạm vi công việc do Sprint đã hoàn thành/đã đóng";

    /** How many unfinished backlog titles are quoted in the completion error. */
    static final int MAX_UNFINISHED_TITLES_IN_MESSAGE = 5;

    SprintMapper sprintMapper;
    SprintRepository sprintRepository;
    SprintAuditService sprintAuditService;
    SprintOutboxService sprintOutboxService;
    SprintBacklogRepository sprintBacklogRepository;
    com.example.starter_project_2025.system.project.task.TaskRepository taskRepository;

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

        throwIfInvalid(errors);

        ensureUniqueName(sprint.getName(), null);

        // A sprint is always created as Planned: any status sent by the client
        // is ignored so the lifecycle can only be advanced through an update.
        sprint.setStatus(SprintStatus.PLANNED);

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
        SprintStatus currentStatus = sprint.getStatus();
        SprintStatus targetStatus = request.getStatus() != null ? request.getStatus() : currentStatus;

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateName(name, errors);
        validateGoal(goal, errors);
        validateDates(startDate, endDate, errors);
        validateStatusTransition(currentStatus, targetStatus, errors);
        validateActivation(sprint.getId(), currentStatus, targetStatus, errors);
        validateCompletion(sprint.getId(), currentStatus, targetStatus, errors);

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
    // Backlog board (UFR-PRJ-003-03)
    // ---------------------------------------------------------------------

    /**
     * Board snapshot of a sprint: its header plus every Sprint Backlog item
     * that belongs to it.
     */
    @Override
    @Transactional(readOnly = true)
    public SprintPlanningDTO getPlanning(Long sprintId) {

        check("SPRINT_READ");

        return buildPlanning(findSprint(sprintId));
    }

    /**
     * Confirms the scope of the board.
     * <p>
     * The board works with Sprint Backlog items: an item without a sprint is a
     * product backlog item, so this operation validates the submitted list and
     * moves the items that are not part of this sprint yet (product backlog or
     * another editable sprint) into the planned sprint. A completed /
     * cancelled sprint rejects the change with 422 (AC02).
     */
    @Override
    public SprintPlanningDTO saveSprintBacklog(Long sprintId, SprintBacklogPlanDTO request) {

        check("SPRINT_UPDATE");

        Sprint sprint = findSprint(sprintId);

        Map<String, List<String>> errors = new LinkedHashMap<>();

        if (!isScopeEditable(sprint)) {
            addError(errors, STATUS_FIELD, scopeLockedMessage(sprint));
        }

        List<Long> orderedIds = distinctBacklogIds(request, errors);

        throwIfInvalid(errors);

        List<SprintBacklog> orderedItems = resolveBacklogItems(orderedIds, errors);

        validateAssignable(sprint, orderedItems, errors);

        throwIfInvalid(errors);

        applyPlan(sprint, orderedItems);

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
    private List<Long> distinctBacklogIds(SprintBacklogPlanDTO request,
                                          Map<String, List<String>> errors) {

        if (request == null || request.getTaskIds() == null) {
            addError(errors, BACKLOG_IDS_FIELD,
                    "Danh sách Backlog item của Sprint Backlog không hợp lệ");
            return List.of();
        }

        List<Long> orderedIds = new ArrayList<>();
        Set<Long> seen = new HashSet<>();

        for (Long backlogId : request.getTaskIds()) {

            if (backlogId == null) {
                addError(errors, BACKLOG_IDS_FIELD, "Backlog item không hợp lệ");
                continue;
            }

            if (!seen.add(backlogId)) {
                addError(errors, BACKLOG_IDS_FIELD,
                        "Danh sách Sprint Backlog chứa Backlog item bị trùng");
                continue;
            }

            orderedIds.add(backlogId);
        }

        return orderedIds;
    }

    /**
     * Loads the submitted ids in the order chosen by the user, reporting the
     * ids that no longer exist.
     */
    private List<SprintBacklog> resolveBacklogItems(List<Long> orderedIds,
                                                    Map<String, List<String>> errors) {

        if (orderedIds.isEmpty()) {
            return List.of();
        }

        Map<Long, SprintBacklog> backlogsById = sprintBacklogRepository.findAllById(orderedIds)
                .stream()
                .collect(Collectors.toMap(SprintBacklog::getId, Function.identity()));

        List<SprintBacklog> ordered = new ArrayList<>(orderedIds.size());

        for (Long backlogId : orderedIds) {

            SprintBacklog backlog = backlogsById.get(backlogId);

            if (backlog == null) {
                addError(errors, BACKLOG_IDS_FIELD,
                        "Backlog item #" + backlogId + " không tồn tại hoặc đã bị xoá");
                continue;
            }

            ordered.add(backlog);
        }

        return ordered;
    }

    /**
     * An item that is not assigned to a sprint (product backlog) or that belongs
     * to an editable sprint (Planned / Active) can be pulled into this sprint; a
     * closed sprint keeps its scope frozen.
     */
    private void validateAssignable(Sprint sprint,
                                    List<SprintBacklog> orderedItems,
                                    Map<String, List<String>> errors) {

        Long sprintId = sprint.getId();

        for (SprintBacklog backlog : orderedItems) {

            Sprint owner = backlog.getSprint();

            if (owner == null || owner.getId().equals(sprintId) || isScopeEditable(owner)) {
                continue;
            }

            addError(errors, BACKLOG_IDS_FIELD,
                    "Backlog item #" + backlog.getId()
                            + " thuộc Sprint đã hoàn thành/đã đóng nên không thể chuyển sang Sprint này");
        }
    }

    /**
     * Synchronises the sprint scope with the submitted board.
     * <p>
     * Items of the submitted list that are not part of this sprint yet (product
     * backlog items or items of another editable sprint) are moved into this
     * sprint, and items that currently belong to this sprint but are no longer
     * listed return to the product backlog (their sprint is cleared).
     */
    private void applyPlan(Sprint sprint, List<SprintBacklog> orderedItems) {

        boolean changed = false;

        Set<Long> keptIds = new HashSet<>();

        for (SprintBacklog backlog : orderedItems) {

            keptIds.add(backlog.getId());

            Sprint owner = backlog.getSprint();

            if (owner != null && sprint.getId().equals(owner.getId())) {
                continue;
            }

            backlog.setSprint(sprint);
            sprintBacklogRepository.save(backlog);
            changed = true;
        }

        // Anything still holding this sprint but absent from the submitted
        // board was removed by the user: send it back to the product backlog.
        for (SprintBacklog backlog : sprintBacklogRepository.findBySprintIdOrderByIdAsc(sprint.getId())) {

            if (keptIds.contains(backlog.getId())) {
                continue;
            }

            backlog.setSprint(null);
            sprintBacklogRepository.save(backlog);
            changed = true;
        }

        if (changed) {
            sprintBacklogRepository.flush();
        }
    }

    private SprintPlanningDTO buildPlanning(Sprint sprint) {

        Long projectId = sprint.getProjectId();

        List<SprintBacklog> backlogs =
                sprintBacklogRepository.findBySprintIdOrderByIdAsc(sprint.getId());

        List<SprintPlanningItemDTO> sprintItems = new ArrayList<>(backlogs.size());

        for (int index = 0; index < backlogs.size(); index++) {
            sprintItems.add(SprintPlanningItemDTO.from(backlogs.get(index), projectId, index + 1));
        }

        // Only items that do not belong to any sprint yet: work that is already
        // planned in another sprint is not offered as a candidate.
        List<SprintBacklog> candidates = sprintBacklogRepository.findBySprintIsNullOrderByIdAsc();

        List<SprintPlanningItemDTO> productItems = new ArrayList<>(candidates.size());

        for (int index = 0; index < candidates.size(); index++) {
            productItems.add(SprintPlanningItemDTO.from(candidates.get(index), projectId, index + 1));
        }

        boolean canPlan = isScopeEditable(sprint);

        return new SprintPlanningDTO(
                sprint.getId(),
                sprint.getName(),
                sprint.getSprintGoal(),
                sprint.getStatus(),
                sprint.getStartDate(),
                sprint.getEndDate(),
                projectId,
                canPlan,
                canPlan ? null : scopeLockedMessage(sprint),
                sprintItems,
                productItems
        );
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

    /**
     * Lifecycle guard: a Planned sprint can only be started (Active) or
     * cancelled, an Active sprint can only be completed or cancelled and a
     * closed sprint (Completed / Cancelled) keeps its final status.
     */
    private void validateStatusTransition(SprintStatus currentStatus,
                                          SprintStatus targetStatus,
                                          Map<String, List<String>> errors) {

        SprintStatus current = currentStatus != null ? currentStatus : SprintStatus.PLANNED;

        if (targetStatus == null || targetStatus == current) {
            return;
        }

        boolean allowed = switch (current) {
            case PLANNED -> targetStatus == SprintStatus.ACTIVE
                    || targetStatus == SprintStatus.CANCELLED;
            case ACTIVE -> targetStatus == SprintStatus.COMPLETED
                    || targetStatus == SprintStatus.CANCELLED;
            default -> false;
        };

        if (!allowed) {
            addError(errors, STATUS_FIELD,
                    "Không thể chuyển Sprint từ trạng thái " + statusLabel(current)
                            + " sang " + statusLabel(targetStatus));
        }
    }

    /**
     * A sprint can only be started once it holds at least one Sprint Backlog
     * item; an empty sprint stays Planned so the team plans work before the
     * sprint begins.
     */
    private void validateActivation(Long sprintId,
                                    SprintStatus currentStatus,
                                    SprintStatus targetStatus,
                                    Map<String, List<String>> errors) {

        if (sprintId == null || targetStatus != SprintStatus.ACTIVE
                || targetStatus == currentStatus) {
            return;
        }

        if (sprintBacklogRepository.countBySprintId(sprintId) > 0) {
            return;
        }

        addError(errors, STATUS_FIELD,
                "Không thể bắt đầu Sprint vì Sprint Backlog chưa có Backlog item nào");
    }

    private String statusLabel(SprintStatus status) {

        return switch (status) {
            case PLANNED -> "Planned";
            case ACTIVE -> "Active";
            case COMPLETED -> "Completed";
            case CANCELLED -> "Cancelled";
        };
    }

    /**
     * A sprint may only be completed once every Sprint Backlog item that
     * belongs to it is {@code Done}; otherwise the transition answers 422 and
     * lists the items that still have to be finished.
     */
    private void validateCompletion(Long sprintId,
                                    SprintStatus currentStatus,
                                    SprintStatus targetStatus,
                                    Map<String, List<String>> errors) {

        if (sprintId == null || targetStatus != SprintStatus.COMPLETED
                || targetStatus == currentStatus) {
            return;
        }

        List<SprintBacklog> unfinished = sprintBacklogRepository.findUnfinishedBySprintId(
                sprintId, List.of(SprintBacklogStatus.DONE));

        if (unfinished.isEmpty()) {
            return;
        }

        addError(errors, STATUS_FIELD, unfinishedBacklogMessage(unfinished));
    }

    private String unfinishedBacklogMessage(List<SprintBacklog> unfinished) {

        String titles = unfinished.stream()
                .limit(MAX_UNFINISHED_TITLES_IN_MESSAGE)
                .map(SprintBacklog::getTitle)
                .filter(title -> title != null && !title.isBlank())
                .collect(Collectors.joining(", "));

        StringBuilder message = new StringBuilder()
                .append("Không thể hoàn thành Sprint vì còn ")
                .append(unfinished.size())
                .append(" Backlog item chưa ở trạng thái Done");

        if (!titles.isEmpty()) {
            message.append(": ").append(titles);

            if (unfinished.size() > MAX_UNFINISHED_TITLES_IN_MESSAGE) {
                message.append("...");
            }
        }

        return message.toString();
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
