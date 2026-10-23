package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.Project;
import com.example.starter_project_2025.system.project.ProjectRepository;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sprint use case implementation for UFR-PRJ-003-01.
 * <p>
 * Business rules covered:
 * <ul>
 *     <li>start date &lt; end date and both inside the project operating window (422)</li>
 *     <li>sprint name unique per project (409)</li>
 *     <li>sprint goal 1..500 characters (422)</li>
 *     <li>a new sprint can only be Planned or Active</li>
 *     <li>audit log (actor, timestamp, before/after, correlation id) + outbox event (idempotent)</li>
 * </ul>
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
    static final String PROJECT_FIELD = "projectId";

    static final String EVENT_CREATED = "SPRINT_CREATED";
    static final String EVENT_UPDATED = "SPRINT_UPDATED";
    static final String EVENT_DELETED = "SPRINT_DELETED";

    SprintMapper sprintMapper;
    SprintRepository sprintRepository;
    ProjectRepository projectRepository;
    SprintAuditService sprintAuditService;
    SprintOutboxService sprintOutboxService;

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

        Project project = resolveProject(request.getProjectId());

        normalize(sprint);

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateName(sprint.getName(), errors);
        validateGoal(sprint.getSprintGoal(), errors);
        validateDates(sprint.getStartDate(), sprint.getEndDate(), project, errors);
        validateCreateStatus(sprint.getStatus(), errors);

        throwIfInvalid(errors);

        ensureUniqueName(project, sprint.getName(), null);

        if (sprint.getStatus() == null) {
            sprint.setStatus(SprintStatus.PLANNED);
        }

        if (sprint.getIsActive() == null) {
            sprint.setIsActive(true);
        }

        sprint.setProject(project);
    }

    @Override
    protected void afterCreate(Sprint saved, SprintDTO request) {

        Map<String, Object> after = snapshot(saved);
        Long projectId = saved.getProject() == null ? null : saved.getProject().getId();

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

        Project project = sprint.getProject();

        if (request.getProjectId() != null && !request.getProjectId().equals(project.getId())) {
            project = resolveProject(request.getProjectId());
        }

        String name = request.getName() != null ? request.getName().trim() : sprint.getName();
        String goal = request.getSprintGoal() != null ? request.getSprintGoal().trim() : sprint.getSprintGoal();
        LocalDateTime startDate = request.getStartDate() != null ? request.getStartDate() : sprint.getStartDate();
        LocalDateTime endDate = request.getEndDate() != null ? request.getEndDate() : sprint.getEndDate();

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateName(name, errors);
        validateGoal(goal, errors);
        validateDates(startDate, endDate, project, errors);

        throwIfInvalid(errors);

        if (request.getName() != null) {
            ensureUniqueName(project, name, sprint.getId());
        }

        Map<String, Object> before = snapshot(sprint);

        sprint.setProject(project);
        request.setName(name);
        request.setSprintGoal(goal);

        sprintMapper.update(sprint, request);

        Sprint saved = sprintRepository.save(sprint);

        Map<String, Object> after = snapshot(saved);
        Long projectId = project.getId();

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
        Long projectId = sprint.getProject() == null ? null : sprint.getProject().getId();

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
     * Materialises sprint rows (including the project name) inside the
     * transaction so the generic exporter never sees a lazy proxy.
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
    // Validation helpers
    // ---------------------------------------------------------------------

    private Project resolveProject(Long projectId) {

        if (projectId == null) {
            throw new SprintValidationException(PROJECT_FIELD, "Vui lòng chọn Project cho Sprint");
        }

        return projectRepository.findById(projectId)
                .orElseThrow(() -> new SprintValidationException(PROJECT_FIELD,
                        "Project không tồn tại hoặc bạn không có quyền truy cập"));
    }

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
                               Project project,
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

        if (project == null) {
            return;
        }

        LocalDate windowStart = project.getStartDate();
        LocalDate windowEnd = project.getEndDate();

        if (windowStart != null && startDate != null && startDate.toLocalDate().isBefore(windowStart)) {
            errors.put(START_DATE_FIELD, List.of(
                    "Thời gian bắt đầu phải nằm trong khoảng thời gian vận hành của Project (từ "
                            + windowStart + ")"));
        }

        if (windowEnd != null && endDate != null && endDate.toLocalDate().isAfter(windowEnd)) {
            errors.put(END_DATE_FIELD, List.of(
                    "Thời gian kết thúc phải nằm trong khoảng thời gian vận hành của Project (đến "
                            + windowEnd + ")"));
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

    private void ensureUniqueName(Project project, String name, Long excludedId) {

        boolean exists = excludedId == null
                ? sprintRepository.existsByProjectIdAndName(project.getId(), name)
                : sprintRepository.existsByProjectIdAndNameAndIdNot(project.getId(), name, excludedId);

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
        snapshot.put("projectId", sprint.getProject() == null ? null : sprint.getProject().getId());
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
