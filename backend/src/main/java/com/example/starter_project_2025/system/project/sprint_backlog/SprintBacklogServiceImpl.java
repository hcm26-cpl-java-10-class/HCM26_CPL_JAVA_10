package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLogDTO;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sprint Backlog use case implementation.
 * <p>
 * Business rules covered:
 * <ul>
 *     <li>a backlog item always belongs to an existing sprint (422 otherwise)</li>
 *     <li>title mandatory, 1..200 characters (422)</li>
 *     <li>description optional, at most 2000 characters (422)</li>
 *     <li>start date &lt; end date when both are provided (422)</li>
 *     <li>status one of {@link SprintBacklogStatus} (To do / In progress / Review / Done)</li>
 *     <li>optimistic locking (409) + audit trail (actor, timestamp, before/after, correlation id)</li>
 * </ul>
 * The assignee is a temporary raw identifier: the project member module is not
 * implemented yet, so it is neither validated nor resolved here.
 */
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintBacklogServiceImpl
        extends BaseCrudServiceImpl<SprintBacklog, Long, SprintBacklogDTO, SprintBacklogFilter>
        implements SprintBacklogService {

    static final int MAX_TITLE_LENGTH = 200;
    static final int MAX_DESCRIPTION_LENGTH = 2000;

    static final String SPRINT_ID_FIELD = "sprintId";
    static final String ASSIGNEE_FIELD = "assigneeProjectMemberId";
    static final String TITLE_FIELD = "title";
    static final String DESCRIPTION_FIELD = "description";
    static final String START_DATE_FIELD = "startDate";
    static final String END_DATE_FIELD = "endDate";
    static final String STATUS_FIELD = "status";

    static final String ACTION_CREATE = "CREATE";
    static final String ACTION_UPDATE = "UPDATE";
    static final String ACTION_DELETE = "DELETE";

    SprintBacklogMapper sprintBacklogMapper;
    SprintBacklogRepository sprintBacklogRepository;
    SprintRepository sprintRepository;
    SprintBacklogAuditService sprintBacklogAuditService;

    @Override
    protected BaseCrudRepository<SprintBacklog, Long> getRepository() {
        return sprintBacklogRepository;
    }

    @Override
    protected BaseCrudMapper<SprintBacklog, SprintBacklogDTO> getMapper() {
        return sprintBacklogMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"title", "description"};
    }

    // ---------------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------------

    @Override
    protected void beforeCreate(SprintBacklog backlog,
                                SprintBacklogDTO request,
                                ValidationContext ctx) {

        normalize(backlog);

        Map<String, List<String>> errors = new LinkedHashMap<>();

        Sprint sprint = resolveSprint(request.getSprintId(), errors);

        validateTitle(backlog.getTitle(), errors);
        validateDescription(backlog.getDescription(), errors);
        validateDates(backlog.getStartDate(), backlog.getEndDate(), errors);
        validateAssignee(backlog.getAssigneeProjectMemberId(), errors);

        throwIfInvalid(errors);

        backlog.setSprint(sprint);

        if (backlog.getStatus() == null) {
            backlog.setStatus(SprintBacklogStatus.TODO);
        }

        if (backlog.getIsActive() == null) {
            backlog.setIsActive(true);
        }
    }

    @Override
    protected void afterCreate(SprintBacklog saved, SprintBacklogDTO request) {

        sprintBacklogAuditService.record(
                ACTION_CREATE,
                saved.getId(),
                sprintIdOf(saved),
                null,
                snapshot(saved)
        );
    }

    // ---------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------

    /**
     * Overridden to keep full control over the audit trail and over the
     * validation of the merged state (a partial update must still respect the
     * length and date rules): the base implementation would lose the "before"
     * snapshot once the entity has been mutated.
     */
    @Override
    public SprintBacklogDTO update(Long id, SprintBacklogDTO request) {

        checkPermission(CrudAction.UPDATE);

        SprintBacklog backlog = requireBacklog(id);

        String title = request.getTitle() != null
                ? request.getTitle().trim()
                : backlog.getTitle();
        String description = request.getDescription() != null
                ? request.getDescription().trim()
                : backlog.getDescription();
        LocalDateTime startDate = request.getStartDate() != null
                ? request.getStartDate()
                : backlog.getStartDate();
        LocalDateTime endDate = request.getEndDate() != null
                ? request.getEndDate()
                : backlog.getEndDate();
        Long assigneeId = request.getAssigneeProjectMemberId() != null
                ? request.getAssigneeProjectMemberId()
                : backlog.getAssigneeProjectMemberId();

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateTitle(title, errors);
        validateDescription(description, errors);
        validateDates(startDate, endDate, errors);
        validateAssignee(assigneeId, errors);

        Sprint sprint = backlog.getSprint();

        if (request.getSprintId() != null
                && (sprint == null || !request.getSprintId().equals(sprint.getId()))) {
            sprint = resolveSprint(request.getSprintId(), errors);
        }

        throwIfInvalid(errors);

        Map<String, Object> before = snapshot(backlog);

        request.setTitle(title);
        request.setDescription(description);

        sprintBacklogMapper.update(backlog, request);

        backlog.setSprint(sprint);

        SprintBacklog saved = sprintBacklogRepository.save(backlog);

        sprintBacklogAuditService.record(
                ACTION_UPDATE,
                saved.getId(),
                sprintIdOf(saved),
                before,
                snapshot(saved)
        );

        return sprintBacklogMapper.toResponse(saved);
    }

    // ---------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------

    @Override
    public void delete(Long id) {

        checkPermission(CrudAction.DELETE);

        SprintBacklog backlog = requireBacklog(id);

        Map<String, Object> before = snapshot(backlog);

        sprintBacklogAuditService.record(
                ACTION_DELETE,
                id,
                sprintIdOf(backlog),
                before,
                null
        );

        sprintBacklogRepository.delete(backlog);
    }

    // ---------------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<SprintBacklogDTO> getBySprintId(Long sprintId) {

        check("SPRINT_BACKLOG_READ");

        if (!sprintRepository.existsById(sprintId)) {
            throw new ResourceNotFoundException("Sprint", "id", sprintId);
        }

        return sprintBacklogRepository.findBySprintIdOrderByIdAsc(sprintId)
                .stream()
                .map(sprintBacklogMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SprintBacklogAuditLogDTO> getAuditLogs(Long sprintBacklogId) {

        check("SPRINT_BACKLOG_READ");

        requireBacklog(sprintBacklogId);

        return sprintBacklogAuditService.getAuditLogs(sprintBacklogId);
    }

    // ---------------------------------------------------------------------
    // Validation helpers
    // ---------------------------------------------------------------------

    /**
     * The sprint relation is mandatory and must point at an existing sprint.
     */
    private Sprint resolveSprint(Long sprintId, Map<String, List<String>> errors) {

        if (sprintId == null) {
            addError(errors, SPRINT_ID_FIELD, "Vui lòng chọn Sprint cho Sprint Backlog");
            return null;
        }

        Sprint sprint = sprintRepository.findById(sprintId).orElse(null);

        if (sprint == null) {
            addError(errors, SPRINT_ID_FIELD,
                    "Sprint #" + sprintId + " không tồn tại hoặc đã bị xoá");
        }

        return sprint;
    }

    private void validateTitle(String title, Map<String, List<String>> errors) {

        if (title == null || title.isBlank()) {
            addError(errors, TITLE_FIELD, "Vui lòng nhập tiêu đề Sprint Backlog");
            return;
        }

        if (title.length() > MAX_TITLE_LENGTH) {
            addError(errors, TITLE_FIELD,
                    "Tiêu đề Sprint Backlog không vượt quá " + MAX_TITLE_LENGTH + " ký tự");
        }
    }

    private void validateDescription(String description, Map<String, List<String>> errors) {

        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            addError(errors, DESCRIPTION_FIELD,
                    "Mô tả Sprint Backlog không vượt quá " + MAX_DESCRIPTION_LENGTH + " ký tự");
        }
    }

    /**
     * Start and end date are optional, but when one of them is provided the
     * other one is required and start must be strictly before end.
     */
    private void validateDates(LocalDateTime startDate,
                               LocalDateTime endDate,
                               Map<String, List<String>> errors) {

        if (startDate == null && endDate == null) {
            return;
        }

        if (startDate == null) {
            addError(errors, START_DATE_FIELD, "Vui lòng chọn thời gian bắt đầu");
            return;
        }

        if (endDate == null) {
            addError(errors, END_DATE_FIELD, "Vui lòng chọn thời gian kết thúc");
            return;
        }

        if (!startDate.isBefore(endDate)) {
            addError(errors, END_DATE_FIELD, "Thời gian kết thúc phải sau thời gian bắt đầu");
        }
    }

    /**
     * TEMPORARY: the assignee is only checked for a positive identifier because
     * the project member module (and its lookup) is not implemented yet.
     */
    private void validateAssignee(Long assigneeId, Map<String, List<String>> errors) {

        if (assigneeId != null && assigneeId <= 0) {
            addError(errors, ASSIGNEE_FIELD, "Người phụ trách không hợp lệ");
        }
    }

    private void throwIfInvalid(Map<String, List<String>> errors) {

        if (!errors.isEmpty()) {
            throw new SprintBacklogValidationException(errors);
        }
    }

    private void addError(Map<String, List<String>> errors, String field, String message) {

        errors.computeIfAbsent(field, key -> new ArrayList<>()).add(message);
    }

    private void normalize(SprintBacklog backlog) {

        if (backlog.getTitle() != null) {
            backlog.setTitle(backlog.getTitle().trim());
        }

        if (backlog.getDescription() != null) {
            backlog.setDescription(backlog.getDescription().trim());
        }
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private SprintBacklog requireBacklog(Long id) {

        return sprintBacklogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SprintBacklog", "id", id));
    }

    private Long sprintIdOf(SprintBacklog backlog) {

        return backlog.getSprint() == null ? null : backlog.getSprint().getId();
    }

    private Map<String, Object> snapshot(SprintBacklog backlog) {

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", backlog.getId());
        snapshot.put("sprintId", sprintIdOf(backlog));
        snapshot.put("assigneeProjectMemberId", backlog.getAssigneeProjectMemberId());
        snapshot.put("title", backlog.getTitle());
        snapshot.put("description", backlog.getDescription());
        snapshot.put("startDate", backlog.getStartDate());
        snapshot.put("endDate", backlog.getEndDate());
        snapshot.put("status", backlog.getStatus());
        snapshot.put("isActive", backlog.getIsActive());
        snapshot.put("version", backlog.getVersion());

        return snapshot;
    }
}
