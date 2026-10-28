package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLogDTO;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditService;
import com.example.starter_project_2025.system.project.sprint_backlog.event.SprintBacklogOutboxService;
import com.example.starter_project_2025.system.project.task.TaskRepository;
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
import java.util.UUID;

/**
 * Sprint Backlog use case implementation.
 * <p>
 * Business rules covered:
 * <ul>
 *     <li>the owning sprint is optional: without it the item is a product
 *     backlog item; when provided it must exist (422 otherwise)</li>
 *     <li>the owning project is derived from the sprint / linked milestone, or
 *     taken from the request (UFR-PRJ-003-02)</li>
 *     <li>the linked milestone must exist and still be active (404 otherwise,
 *     AC03); a milestone of another project than the sprint is rejected
 *     (422)</li>
 *     <li>title mandatory, 1..200 characters (422)</li>
 *     <li>description optional, at most 2000 characters (422)</li>
 *     <li>start date &lt; end date when both are provided (422)</li>
 *     <li>status one of {@link SprintBacklogStatus} (To do / In progress / Review / Done)</li>
 *     <li>work type one of {@link SprintBacklogWorkType} (Story / Bug / Task), task by
 *     default - the set is fixed, no new work type can be created</li>
 *     <li>priority one of {@link SprintBacklogPriority}, medium by default</li>
 *     <li>estimated hours, when provided, must be greater than or equal to 0 (422)</li>
 *     <li>optimistic locking (409) + audit trail (actor, timestamp, before/after, correlation id)
 *     + outbox event for the team notification (UFR-PRJ-003-02)</li>
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
    static final String PROJECT_ID_FIELD = "projectId";
    static final String MILESTONE_ID_FIELD = "milestoneId";
    static final String ASSIGNEE_FIELD = "assigneeProjectMemberId";
    static final String TITLE_FIELD = "title";
    static final String DESCRIPTION_FIELD = "description";
    static final String START_DATE_FIELD = "startDate";
    static final String END_DATE_FIELD = "endDate";
    static final String STATUS_FIELD = "status";
    static final String ESTIMATED_HOURS_FIELD = "estimatedHours";

    static final String ACTION_CREATE = "CREATE";
    static final String ACTION_UPDATE = "UPDATE";
    static final String ACTION_DELETE = "DELETE";

    static final String EVENT_CREATED = "SPRINT_BACKLOG_ITEM_CREATED";
    static final String EVENT_UPDATED = "SPRINT_BACKLOG_ITEM_UPDATED";

    static final String MILESTONE_NOT_FOUND_MESSAGE =
            "Milestone không tồn tại hoặc đã bị thay đổi";

    SprintBacklogMapper sprintBacklogMapper;
    SprintBacklogRepository sprintBacklogRepository;
    SprintRepository sprintRepository;
    MilestoneRepository milestoneRepository;
    MilestoneTenantProvider milestoneTenantProvider;
    SprintBacklogAuditService sprintBacklogAuditService;
    SprintBacklogOutboxService sprintBacklogOutboxService;
    TaskRepository subtasks;
    ProjectMemberRepository projectMemberRepository;

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

        // AC03: a milestone that no longer exists / was cancelled fails the
        // whole request with 404 instead of an inline field error.
        Milestone milestone = resolveMilestone(request.getMilestoneId());

        Long projectId = resolveProjectId(request.getProjectId(), sprint, milestone, errors);

        validateTitle(backlog.getTitle(), errors);
        validateDescription(backlog.getDescription(), errors);
        validateDates(backlog.getStartDate(), backlog.getEndDate(), errors);
        validateAssignee(backlog.getAssigneeProjectMemberId(), errors);
        validateEstimatedHours(backlog.getEstimatedHours(), errors);

        throwIfInvalid(errors);

        backlog.setSprint(sprint);
        backlog.setMilestone(milestone);
        backlog.setProjectId(projectId);

        if (backlog.getStatus() == null) {
            backlog.setStatus(SprintBacklogStatus.TODO);
        }

        if (backlog.getPriority() == null) {
            backlog.setPriority(SprintBacklogPriority.MEDIUM);
        }

        // Fixed set (Story / Bug / Task): no new work type can be created.
        if (backlog.getWorkType() == null) {
            backlog.setWorkType(SprintBacklogWorkType.DEFAULT);
        }

        if (backlog.getIsActive() == null) {
            backlog.setIsActive(true);
        }
    }

    @Override
    protected void afterCreate(SprintBacklog saved, SprintBacklogDTO request) {

        Map<String, Object> after = snapshot(saved);

        sprintBacklogAuditService.record(
                ACTION_CREATE,
                saved.getId(),
                sprintIdOf(saved),
                null,
                after
        );

        sprintBacklogOutboxService.enqueue(
                EVENT_CREATED,
                saved.getId(),
                saved.getProjectId(),
                after
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

        SprintBacklog backlog = sprintBacklogRepository.findForSubtaskUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Backlog item was not found"));

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
        Double estimatedHours = request.getEstimatedHours() != null
                ? request.getEstimatedHours()
                : backlog.getEstimatedHours();

        Map<String, List<String>> errors = new LinkedHashMap<>();

        validateTitle(title, errors);
        validateDescription(description, errors);
        validateDates(startDate, endDate, errors);
        validateAssignee(assigneeId, errors);
        validateEstimatedHours(estimatedHours, errors);

        Sprint sprint = backlog.getSprint();

        if (request.getSprintId() != null
                && (sprint == null || !request.getSprintId().equals(sprint.getId()))) {
            sprint = resolveSprint(request.getSprintId(), errors);
        }

        // `null` milestoneId means "keep the current link": removing the link
        // is explicit through `clearMilestone` so a partial update cannot
        // silently drop the milestone.
        Milestone currentMilestone = backlog.getMilestone();
        UUID requestedMilestoneId = request.getMilestoneId();

        Milestone milestone;

        if (Boolean.TRUE.equals(request.getClearMilestone())) {
            milestone = null;
        } else if (requestedMilestoneId != null
                && (currentMilestone == null || !requestedMilestoneId.equals(currentMilestone.getId()))) {
            milestone = resolveMilestone(requestedMilestoneId);
        } else {
            milestone = currentMilestone;
        }

        Long projectId = resolveProjectId(
                request.getProjectId() != null ? request.getProjectId() : backlog.getProjectId(),
                sprint,
                milestone,
                errors
        );

        if (!java.util.Objects.equals(projectId, backlog.getProjectId()) && subtasks.existsByBacklogItem_Id(id)) {
            errors.put(PROJECT_ID_FIELD, List.of("A backlog item with subtasks cannot be moved to another project"));
        }

        throwIfInvalid(errors);

        Map<String, Object> before = snapshot(backlog);

        request.setTitle(title);
        request.setDescription(description);

        sprintBacklogMapper.update(backlog, request);

        backlog.setSprint(sprint);
        backlog.setMilestone(milestone);
        backlog.setProjectId(projectId);

        SprintBacklog saved = sprintBacklogRepository.save(backlog);

        Map<String, Object> after = snapshot(saved);

        sprintBacklogAuditService.record(
                ACTION_UPDATE,
                saved.getId(),
                sprintIdOf(saved),
                before,
                after
        );

        sprintBacklogOutboxService.enqueue(
                EVENT_UPDATED,
                saved.getId(),
                saved.getProjectId(),
                after
        );

        return sprintBacklogMapper.toResponse(saved);
    }

    // ---------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------

    @Override
    public void delete(Long id) {

        checkPermission(CrudAction.DELETE);

        SprintBacklog backlog = sprintBacklogRepository.findForSubtaskUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Backlog item was not found"));
        if (subtasks.existsByBacklogItem_Id(id)) {
            throw new SprintBacklogValidationException(Map.of("subtasks",
                    List.of("A backlog item with subtask history cannot be deleted")));
        }

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

    /**
     * Active milestones the student can link a backlog item to
     * (UFR-PRJ-003-02). Used by the milestone picker of the backlog form and of
     * the work item detail panel.
     * <p>
     * When {@code teamId} is set (Backlog tab of a team workspace) the picker is
     * limited to the milestones of that team, so a workspace never offers the
     * milestones of another team that happens to work on the same project.
     */
    @Override
    @Transactional(readOnly = true)
    public List<BacklogMilestoneOptionDTO> getMilestoneOptions(Long teamId) {

        check("SPRINT_BACKLOG_READ");

        Long tenantId = milestoneTenantProvider.requireCurrentTenantId();

        List<Milestone> candidates = teamId == null
                ? milestoneRepository.findByTenantIdAndActiveTrueOrderByDeadlineAscIdAsc(tenantId)
                : milestoneRepository.findByTenantIdAndTeamIdAndActiveTrueOrderByDeadlineAscIdAsc(tenantId, teamId);

        return candidates
                .stream()
                .filter(milestone -> milestone.getStatus() == com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus.OPEN)
                .map(milestone -> new BacklogMilestoneOptionDTO(
                        milestone.getId(),
                        milestone.getProjectId(),
                        milestone.getTitle(),
                        milestoneLabel(milestone),
                        milestone.getStatus() == null ? null : milestone.getStatus().name(),
                        milestone.getDeadline(),
                        milestone.isMandatory()
                ))
                .toList();
    }

    /**
     * Active members of the workspace team, used by the assignee picker of the
     * backlog create bar instead of a raw project member id.
     */
    @Override
    @Transactional(readOnly = true)
    public List<BacklogAssigneeOptionDTO> getAssigneeOptions(Long teamId) {

        check("SPRINT_BACKLOG_READ");

        if (teamId == null) {
            return List.of();
        }

        List<ProjectMember> members =
                projectMemberRepository.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(
                        teamId,
                        com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus.ACTIVE);

        return members.stream()
                .map(member -> new BacklogAssigneeOptionDTO(
                        member.getId(),
                        member.getClassMember().getUser().getId(),
                        member.getClassMember().getUser().getFullName(),
                        member.getClassMember().getUser().getUserCode(),
                        member.getRole()
                ))
                .toList();
    }

    // ---------------------------------------------------------------------
    // Validation helpers
    // ---------------------------------------------------------------------

    /**
     * The sprint relation is optional: {@code null} keeps the item in the
     * product backlog. A provided id must point at an existing sprint.
     */
    private Sprint resolveSprint(Long sprintId, Map<String, List<String>> errors) {

        if (sprintId == null) {
            return null;
        }

        Sprint sprint = sprintRepository.findById(sprintId).orElse(null);

        if (sprint == null) {
            addError(errors, SPRINT_ID_FIELD,
                    "Sprint #" + sprintId + " không tồn tại hoặc đã bị xoá");
        }

        return sprint;
    }

    /**
     * Resolves the milestone to link (UFR-PRJ-003-02).
     * <p>
     * A milestone that does not exist, or that was cancelled / removed
     * ({@code active = false}), rejects the request with 404 so the UI can tell
     * the user to pick another milestone while keeping the form data (AC03).
     */
    private Milestone resolveMilestone(UUID milestoneId) {

        if (milestoneId == null) {
            return null;
        }

        return milestoneRepository.findById(milestoneId)
                .filter(Milestone::isActive)
                .orElseThrow(() -> new ResourceNotFoundException(MILESTONE_NOT_FOUND_MESSAGE));
    }

    /**
     * Derives the owning project of the item: the milestone project wins, then
     * the sprint project, then the explicit request value. A milestone that
     * belongs to another project than the sprint (or than the requested
     * project) is rejected with 422.
     */
    private Long resolveProjectId(Long requestedProjectId,
                                  Sprint sprint,
                                  Milestone milestone,
                                  Map<String, List<String>> errors) {

        Long sprintProjectId = sprint == null ? null : sprint.getProjectId();
        Long milestoneProjectId = milestone == null ? null : milestone.getProjectId();

        if (sprint != null && sprint.getTeamId() != null && milestone != null
                && !sprint.getTeamId().equals(milestone.getTeamId())) {
            addError(errors, MILESTONE_ID_FIELD,
                    "Milestone không thuộc Team của Sprint đã chọn");
        }

        if (sprintProjectId != null
                && milestoneProjectId != null
                && !sprintProjectId.equals(milestoneProjectId)) {
            addError(errors, MILESTONE_ID_FIELD,
                    "Milestone không thuộc Project của Sprint đã chọn");
        }

        Long derivedProjectId = milestoneProjectId != null ? milestoneProjectId : sprintProjectId;

        if (derivedProjectId != null
                && requestedProjectId != null
                && !derivedProjectId.equals(requestedProjectId)) {
            addError(errors, PROJECT_ID_FIELD,
                    "Project không khớp với Sprint / Milestone đã chọn");
        }

        return derivedProjectId != null ? derivedProjectId : requestedProjectId;
    }

    private String milestoneLabel(Milestone milestone) {

        return milestone.getProjectId() == null
                ? milestone.getTitle()
                : "Project " + milestone.getProjectId() + " · " + milestone.getTitle();
    }

    private void validateTitle(String title, Map<String, List<String>> errors) {

        if (title == null || title.isBlank()) {
            addError(errors, TITLE_FIELD, "Vui lòng nhập tên Backlog item");
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
                    "Mô tả không được vượt quá " + MAX_DESCRIPTION_LENGTH + " ký tự");
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

    /**
     * The effort estimate is optional; when provided it cannot be negative.
     */
    private void validateEstimatedHours(Double estimatedHours,
                                        Map<String, List<String>> errors) {

        if (estimatedHours != null && estimatedHours < 0) {
            addError(errors, ESTIMATED_HOURS_FIELD,
                    "Số giờ ước tính phải lớn hơn hoặc bằng 0");
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

    private UUID milestoneIdOf(SprintBacklog backlog) {

        return backlog.getMilestone() == null ? null : backlog.getMilestone().getId();
    }

    private String milestoneNameOf(SprintBacklog backlog) {

        return backlog.getMilestone() == null ? null : backlog.getMilestone().getTitle();
    }

    private Map<String, Object> snapshot(SprintBacklog backlog) {

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", backlog.getId());
        snapshot.put("projectId", backlog.getProjectId());
        snapshot.put("sprintId", sprintIdOf(backlog));
        snapshot.put("milestoneId", milestoneIdOf(backlog));
        snapshot.put("milestoneName", milestoneNameOf(backlog));
        snapshot.put("assigneeProjectMemberId", backlog.getAssigneeProjectMemberId());
        snapshot.put("title", backlog.getTitle());
        snapshot.put("description", backlog.getDescription());
        snapshot.put("startDate", backlog.getStartDate());
        snapshot.put("endDate", backlog.getEndDate());
        snapshot.put("status", backlog.getStatus());
        snapshot.put("workType", backlog.getWorkType());
        snapshot.put("priority", backlog.getPriority());
        snapshot.put("estimatedHours", backlog.getEstimatedHours());
        snapshot.put("isActive", backlog.getIsActive());
        snapshot.put("version", backlog.getVersion());

        return snapshot;
    }
}
