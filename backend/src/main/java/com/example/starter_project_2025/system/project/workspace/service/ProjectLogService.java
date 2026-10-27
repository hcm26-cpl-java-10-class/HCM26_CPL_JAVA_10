package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.Task;
import com.example.starter_project_2025.system.project.sprint.TaskRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignment;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignmentRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffRoleType;
import com.example.starter_project_2025.system.project.workspace.domain.*;
import com.example.starter_project_2025.system.project.workspace.dto.ProjectLogDtos.*;
import com.example.starter_project_2025.system.project.workspace.repository.*;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectLogService {
    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final ProjectMemberRepository members;
    private final ClassStaffAssignmentRepository classStaffAssignments;
    private final ProjectLogRepository logs;
    private final MeetingNoteAttendeeRepository meetingAttendees;
    private final ProjectLogAuditRepository audits;
    private final ProjectLogStatusHistoryRepository histories;
    private final ProjectLogIdempotencyRepository idempotency;
    private final WorkspaceActivityRepository activities;
    private final MilestoneRepository milestones;
    private final SprintRepository sprints;
    private final TaskRepository tasks;
    private final SprintBacklogRepository backlog;
    private final UserRepository users;
    private final ObjectMapper mapper;

    public Page<LogResponse> list(Long workspaceId, ProjectLogType type, String search, Long createdBy,
                                  LocalDate createdFrom, LocalDate createdTo, String targetType, String targetId,
                                  String linkType, String itemTargetType, String itemTargetId,
                                  String status, String category, String severity, LocalDate meetingFrom,
                                  LocalDate meetingTo, Long attendeeId, Boolean hasActionItems,
                                  int page, int size) {
        Context context = context(workspaceId);
        requireRead(context.user());
        if (createdFrom != null && createdTo != null && createdFrom.isAfter(createdTo)
                || meetingFrom != null && meetingTo != null && meetingFrom.isAfter(meetingTo))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Date range start must not be after end");
        Specification<ProjectLog> spec = (root, query, cb) -> cb.and(
                cb.equal(root.get("workspaceId"), workspaceId),
                cb.equal(root.get("deleted"), false),
                type == null ? cb.conjunction() : cb.equal(root.get("type"), type),
                createdBy == null ? cb.conjunction() : cb.equal(root.get("createdBy"), createdBy),
                createdFrom == null ? cb.conjunction() : cb.greaterThanOrEqualTo(root.get("createdAt"),
                        createdFrom.atStartOfDay()),
                createdTo == null ? cb.conjunction() : cb.lessThan(root.get("createdAt"),
                        createdTo.plusDays(1).atStartOfDay()),
                linkedTargetPredicate(context.workspace().getProject() == null ? null : context.workspace().getProject().getId(),
                        targetType, targetId, root, cb),
                linkType == null || linkType.isBlank() ? cb.conjunction()
                        : cb.equal(root.get("targetType"), parseTargetType(linkType)),
                linkedTargetPredicate(null, itemTargetType, itemTargetId, root, cb),
                status == null || status.isBlank() ? cb.conjunction()
                        : cb.equal(root.get("status"), status.toUpperCase(Locale.ROOT)),
                category == null || category.isBlank() ? cb.conjunction()
                        : cb.equal(root.get("category"), category.toUpperCase(Locale.ROOT)),
                severity == null || severity.isBlank() ? cb.conjunction()
                        : cb.equal(root.get("severity"), severity.toUpperCase(Locale.ROOT)),
                meetingFrom == null ? cb.conjunction() : cb.greaterThanOrEqualTo(root.get("meetingDate"),
                        meetingFrom.atStartOfDay().toInstant(ZoneOffset.UTC)),
                meetingTo == null ? cb.conjunction() : cb.lessThan(root.get("meetingDate"),
                        meetingTo.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC)),
                attendeePredicate(root, query, cb, attendeeId),
                hasActionItems == null ? cb.conjunction() : hasActionItems
                        ? cb.and(cb.isNotNull(root.get("actionItems")), cb.notEqual(root.get("actionItems"), ""))
                        : cb.or(cb.isNull(root.get("actionItems")), cb.equal(root.get("actionItems"), "")),
                search == null || search.isBlank() ? cb.conjunction()
                        : cb.or(cb.like(cb.lower(root.get("title")), "%" + search.trim().toLowerCase(Locale.ROOT) + "%"),
                        cb.like(cb.lower(root.get("content")), "%" + search.trim().toLowerCase(Locale.ROOT) + "%"),
                        cb.like(cb.lower(root.get("rationale")), "%" + search.trim().toLowerCase(Locale.ROOT) + "%")));
        Page<ProjectLog> result = logs.findAll(spec, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        var authorIds = result.getContent().stream().map(ProjectLog::getCreatedBy).filter(java.util.Objects::nonNull).distinct().toList();
        var authors = users.findAllById(authorIds).stream().collect(java.util.stream.Collectors.toMap(User::getId,
                User::getFullName, (first, ignored) -> first));
        var logIds = result.getContent().stream().map(ProjectLog::getId).toList();
        var attendeeRows = logIds.isEmpty() ? List.<MeetingNoteAttendee>of()
                : meetingAttendees.findAllByMeetingNote_IdIn(logIds);
        var attendeeMap = attendeeRows.stream()
                .collect(java.util.stream.Collectors.groupingBy(attendee -> attendee.getMeetingNote().getId()));
        return result.map(log -> LogResponse.from(log, authors.getOrDefault(log.getCreatedBy(), "Former member"),
                attendeeResponses(attendeeMap.getOrDefault(log.getId(), List.of()))));
    }

    public Options options(Long workspaceId) {
        Context context = context(workspaceId);
        requireRead(context.user());
        List<LinkOption> milestoneOptions = new ArrayList<>();
        List<LinkOption> sprintOptions = new ArrayList<>();
        List<LinkOption> taskOptions = new ArrayList<>();
        List<LinkOption> backlogOptions = new ArrayList<>();
        if (context.workspace().getProject() != null) {
            Long projectId = context.workspace().getProject().getId();
            Long tenantId = context.workspace().getTenant().getId();
            milestoneOptions.addAll(milestones.findByProjectIdAndTenantIdAndActiveTrueOrderByDeadlineAscIdAsc(projectId, tenantId)
                    .stream().map(m -> new LinkOption(m.getId().toString(), m.getTitle(), ProjectLogTargetType.MILESTONE)).toList());
            List<Sprint> projectSprints = sprints.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(projectId);
            sprintOptions.addAll(projectSprints.stream()
                    .map(s -> new LinkOption(s.getId().toString(), s.getName(), ProjectLogTargetType.SPRINT)).toList());
            taskOptions.addAll(tasks.findByProjectIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(projectId).stream()
                    .map(task -> new LinkOption(task.getId().toString(),
                            task.getCode() + " · " + task.getTitle(), ProjectLogTargetType.TASK)).toList());
            for (Sprint sprint : projectSprints) {
                for (SprintBacklog item : backlog.findBySprintIdOrderByIdAsc(sprint.getId())) {
                    backlogOptions.add(new LinkOption(item.getId().toString(), item.getTitle(), ProjectLogTargetType.BACKLOG_ITEM));
                }
            }
        }
        var authorOptions = new java.util.LinkedHashMap<Long, AuthorOption>();
        var attendeeOptions = new java.util.LinkedHashMap<Long, AttendeeOption>();
        if (context.workspace().getTeam().getAssignedMentorId() != null) {
            users.findById(context.workspace().getTeam().getAssignedMentorId()).ifPresent(mentor ->
                    {
                        if (Boolean.TRUE.equals(mentor.getIsActive())) {
                            authorOptions.put(mentor.getId(), new AuthorOption(mentor.getId(), mentor.getFullName(), "MENTOR"));
                            attendeeOptions.put(mentor.getId(), new AttendeeOption(mentor.getId(), mentor.getFullName(), "MENTOR"));
                        }
                    });
        }
        members.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(context.workspace().getTeam().getId(),
                com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus.ACTIVE)
                .forEach(member -> {
                    User user = member.getClassMember().getUser();
                    if (Boolean.TRUE.equals(user.getIsActive())) {
                        authorOptions.put(user.getId(), new AuthorOption(user.getId(), user.getFullName(), "MEMBER"));
                        attendeeOptions.put(user.getId(), new AttendeeOption(user.getId(), user.getFullName(), "MEMBER"));
                    }
                });
        Long classId = context.workspace().getTeam().getTrainingClass().getId();
        addClassStaffAttendeeOptions(attendeeOptions, classId, ClassStaffRoleType.TRAINER, "TRAINER");
        addClassStaffAttendeeOptions(attendeeOptions, classId, ClassStaffRoleType.CLASS_ADMIN, "CLASS_ADMIN");
        return new Options(List.copyOf(milestoneOptions), List.copyOf(taskOptions), List.copyOf(backlogOptions),
                List.copyOf(sprintOptions),
                List.copyOf(authorOptions.values()), List.copyOf(attendeeOptions.values()));
    }

    @Transactional
    public LogResponse create(Long workspaceId, CreateRequest request, String correlationId, String ip) {
        Context context = context(workspaceId);
        requireWrite(context);
        validateRequest(context.workspace(), request);
        ProjectLogTargetType targetType = request.targetType();
        String targetId = trimToNull(request.targetId());
        if (targetType == null && targetId != null || targetType != null && targetId == null)
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Link type and linked item must be provided together");
        if (targetType != null) {
            if (context.workspace().getProject() == null)
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "This team workspace has no project items to link");
            validateLink(context.workspace(), request.type(), targetType, targetId);
        }

        ProjectLog log = new ProjectLog();
        log.setWorkspaceId(workspaceId);
        log.setTenantId(context.workspace().getTenant().getId());
        log.setProjectId(context.workspace().getProject() == null ? null : context.workspace().getProject().getId());
        log.setTeamId(context.workspace().getTeam().getId());
        log.setType(request.type());
        log.setTitle(request.title().trim());
        log.setContent(request.content().trim());
        log.setRationale(trimToNull(request.rationale()));
        log.setImpactAnalysis(trimToNull(request.impactAnalysis()));
        log.setCategory(request.type() == ProjectLogType.RISK_ISSUE
                ? (request.category() == null ? "RISK" : request.category().toUpperCase(Locale.ROOT)) : null);
        log.setStatus(switch (request.type()) {
            case DECISION -> "PROPOSED";
            case RISK_ISSUE -> "OPEN";
            case MEETING_NOTE -> "RECORDED";
        });
        log.setSeverity(request.type() == ProjectLogType.RISK_ISSUE ? request.severity() : null);
        log.setMitigationPlan(trimToNull(request.mitigationPlan()));
        log.setMeetingDate(request.meetingDate());
        log.setActionItems(trimToNull(request.actionItems()));
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setDeleted(false);
        ProjectLog saved = logs.saveAndFlush(log);
        if (saved.getType() == ProjectLogType.MEETING_NOTE) {
            List<MeetingNoteAttendee> attendeeEntities = users.findAllById(request.attendees()).stream()
                    .map(user -> MeetingNoteAttendee.create(saved, user)).toList();
            meetingAttendees.saveAllAndFlush(attendeeEntities);
            saved.getMeetingNoteAttendees().addAll(attendeeEntities);
        }
        recordAudit(context, saved, "CREATED", null, snapshot(saved), correlationId, ip);
        recordActivity(context.workspace(), context.user(), "PROJECT_LOG_CREATED", correlationId);
        return LogResponse.from(saved, context.user().getFullName(),
                attendeeResponses(saved.getMeetingNoteAttendees()));
    }

    @Transactional
    public LogResponse updateRisk(Long workspaceId, Long logId, RiskUpdateRequest request, Long expectedVersion,
                                  String idempotencyKey, String correlationId, String ip) {
        Context context = context(workspaceId);
        requireWrite(context);
        if (idempotencyKey == null || !idempotencyKey.matches("[A-Za-z0-9._-]{8,100}"))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "A valid Idempotency-Key header is required");
        String hash = sha256(request.mitigationPlan().trim() + "\n" + request.status().trim());
        var prior = idempotency.findByLogIdAndActorIdAndKey(logId, context.user().getId(), idempotencyKey);
        if (prior.isPresent()) {
            if (!prior.get().getRequestHash().equals(hash))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was already used with different details");
            try { return mapper.readValue(prior.get().getResponseJson(), LogResponse.class); }
            catch (JsonProcessingException e) { throw new IllegalStateException("Cannot restore idempotent project log response", e); }
        }
        ProjectLog log = requireLog(workspaceId, logId);
        if (log.getType() != ProjectLogType.RISK_ISSUE)
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Only risk/issue logs can be updated here");
        if (expectedVersion != null && !expectedVersion.equals(log.getVersion()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The risk log was updated by another user");
        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!List.of("OPEN", "IN_MITIGATION", "CLOSED").contains(status))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Risk status is invalid");
        if (request.mitigationPlan().isBlank())
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Mitigation plan is required");

        String before = snapshot(log);
        String oldStatus = log.getStatus();
        log.setMitigationPlan(request.mitigationPlan().trim());
        log.setStatus(status);
        ProjectLog saved = logs.saveAndFlush(log);
        if (!oldStatus.equals(status)) {
            ProjectLogStatusHistory history = new ProjectLogStatusHistory();
            history.setLogId(saved.getId());
            history.setActorId(context.user().getId());
            history.setPreviousStatus(oldStatus);
            history.setNewStatus(status);
            history.setChangedAt(Instant.now());
            histories.save(history);
        }
        recordAudit(context, saved, "UPDATED", before, snapshot(saved), correlationId, ip);
        recordActivity(context.workspace(), context.user(), "PROJECT_LOG_UPDATED", correlationId);
        LogResponse response = LogResponse.from(saved, context.user().getFullName(),
                attendeeResponses(saved.getMeetingNoteAttendees()));
        ProjectLogIdempotency record = new ProjectLogIdempotency();
        record.setLogId(logId);
        record.setActorId(context.user().getId());
        record.setKey(idempotencyKey);
        record.setRequestHash(hash);
        try { record.setResponseJson(mapper.writeValueAsString(response)); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot serialize idempotent project log response", e); }
        idempotency.saveAndFlush(record);
        return response;
    }

    public List<AuditResponse> history(Long workspaceId, Long logId) {
        Context context = context(workspaceId);
        requireRead(context.user());
        requireLog(workspaceId, logId);
        return audits.findByWorkspaceIdAndLogIdOrderByTimestampDesc(workspaceId, logId).stream()
                .map(a -> new AuditResponse(a.getId(), a.getLogId(), a.getActorId(), a.getTimestamp(),
                        a.getCorrelationId(), a.getIp(), a.getAction(), a.getBeforeJson(), a.getAfterJson())).toList();
    }

    public List<StatusHistoryResponse> statusHistory(Long workspaceId, Long logId) {
        Context context = context(workspaceId);
        requireRead(context.user());
        requireLog(workspaceId, logId);
        return histories.findByLogIdOrderByChangedAtDesc(logId).stream()
                .map(h -> new StatusHistoryResponse(h.getId(), h.getLogId(), h.getActorId(), h.getPreviousStatus(),
                        h.getNewStatus(), h.getChangedAt())).toList();
    }

    private record Context(User user, Workspace workspace) { }
    private Context context(Long workspaceId) {
        User user = access.requireUser(false);
        return new Context(user, contexts.require(user, workspaceId));
    }

    private void requireRead(User user) {
        if (!access.permitted(user, "WORKSPACE_ACTIVITY_READ")
                && !access.permitted(user, "WORKSPACE_READ")
                && !access.permitted(user, "VIEW_PROJECT_WORKSPACE"))
            throw new AccessDeniedException("Project log access is not allowed");
    }

    private void requireWrite(Context context) {
        User user = context.user();
        requireRead(user);
        boolean administrator = user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .anyMatch(role -> List.of("ADMIN", "SUPER_ADMIN", "PO").contains(role.getName()));
        boolean assignedMentor = context.workspace().getTeam().getAssignedMentorId() != null
                && context.workspace().getTeam().getAssignedMentorId().equals(user.getId());
        boolean activeMember = members.existsByTeam_IdAndClassMember_User_IdAndClassMember_Status(
                context.workspace().getTeam().getId(), user.getId(),
                com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus.ACTIVE);
        if (!administrator && !assignedMentor && !activeMember)
            throw new AccessDeniedException("Project log changes are not allowed");
    }

    private void validateRequest(Workspace workspace, CreateRequest request) {
        if (request.title().isBlank() || request.content().isBlank())
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Title and content are required");
        switch (request.type()) {
            case DECISION -> {
                if (request.rationale() == null || request.rationale().isBlank())
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Decision rationale is required");
            }
            case RISK_ISSUE -> {
                if (!List.of("LOW", "MEDIUM", "HIGH", "CRITICAL").contains(request.severity()))
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Risk severity is invalid");
                if (request.mitigationPlan() == null || request.mitigationPlan().isBlank())
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Risk mitigation plan is required");
                if (request.category() != null && !List.of("RISK", "ISSUE").contains(request.category().toUpperCase(Locale.ROOT)))
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Risk category is invalid");
            }
            case MEETING_NOTE -> {
                if (request.meetingDate() == null || request.attendees() == null || request.attendees().isEmpty())
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Meeting date and attendees are required");
                validateAttendees(workspace, request.attendees());
            }
        }
    }

    private void validateAttendees(Workspace workspace, List<Long> attendeeIds) {
        if (attendeeIds.stream().anyMatch(java.util.Objects::isNull))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Attendee ID is required");
        if (new java.util.HashSet<>(attendeeIds).size() != attendeeIds.size())
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Duplicate attendees are not allowed");
        var allowedIds = new java.util.HashSet<Long>();
        if (workspace.getTeam().getAssignedMentorId() != null)
            allowedIds.add(workspace.getTeam().getAssignedMentorId());
        members.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(workspace.getTeam().getId(),
                com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus.ACTIVE)
                .forEach(member -> allowedIds.add(member.getClassMember().getUser().getId()));
        Long classId = workspace.getTeam().getTrainingClass().getId();
        for (ClassStaffRoleType role : List.of(ClassStaffRoleType.TRAINER, ClassStaffRoleType.CLASS_ADMIN)) {
            classStaffAssignments.findAllByTrainingClass_IdAndRoleTypeAndIsActiveTrueOrderByUser_FirstNameAsc(classId, role)
                    .forEach(assignment -> allowedIds.add(assignment.getUser().getId()));
        }
        for (Long attendeeId : attendeeIds)
            if (!allowedIds.contains(attendeeId))
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Attendee is outside this project team");
    }

    private void addClassStaffAttendeeOptions(java.util.Map<Long, AttendeeOption> options, Long classId,
                                              ClassStaffRoleType roleType, String roleLabel) {
        List<ClassStaffAssignment> assignments = classStaffAssignments
                .findAllByTrainingClass_IdAndRoleTypeAndIsActiveTrueOrderByUser_FirstNameAsc(classId, roleType);
        assignments.stream()
                .filter(assignment -> Boolean.TRUE.equals(assignment.getUser().getIsActive()))
                .forEach(assignment -> options.putIfAbsent(assignment.getUser().getId(),
                        new AttendeeOption(assignment.getUser().getId(), assignment.getUser().getFullName(), roleLabel)));
    }

    private List<AttendeeResponse> attendeeResponses(List<MeetingNoteAttendee> attendees) {
        return attendees.stream().map(attendee -> new AttendeeResponse(
                attendee.getUser().getId(), attendee.getUser().getFullName())).toList();
    }

    private jakarta.persistence.criteria.Predicate attendeePredicate(
            jakarta.persistence.criteria.Root<ProjectLog> root,
            jakarta.persistence.criteria.CriteriaQuery<?> query,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            Long attendeeId) {
        if (attendeeId == null) return cb.conjunction();
        var subquery = query.subquery(Long.class);
        var attendee = subquery.from(MeetingNoteAttendee.class);
        subquery.select(attendee.get("meetingNote").get("id"));
        subquery.where(
                cb.equal(attendee.get("meetingNote").get("id"), root.get("id")),
                cb.equal(attendee.get("user").get("id"), attendeeId));
        return cb.exists(subquery);
    }

    private void validateLink(Workspace workspace, ProjectLogType type, ProjectLogTargetType targetType, String targetId) {
        try {
            switch (targetType) {
                case MILESTONE -> {
                    UUID id = UUID.fromString(targetId);
                    var milestone = milestones.findById(id)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked milestone was not found"));
                    if (!milestone.isActive()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked milestone was not found");
                    if (!workspace.getProject().getId().equals(milestone.getProjectId())
                            || !workspace.getTenant().getId().equals(milestone.getTenantId()))
                        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Linked milestone is outside this project");
                }
                case SPRINT -> {
                    if (type != ProjectLogType.MEETING_NOTE) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid link type");
                    Long id = Long.valueOf(targetId);
                    Sprint sprint = sprints.findById(id)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked sprint was not found"));
                    if (!Boolean.TRUE.equals(sprint.getIsActive()))
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked sprint was not found");
                    if (!workspace.getProject().getId().equals(sprint.getProjectId()))
                        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Linked sprint is outside this project");
                }
                case TASK -> {
                    if (type == ProjectLogType.MEETING_NOTE) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid link type");
                    Long id = Long.valueOf(targetId);
                    tasks.findByIdAndProjectIdAndIsActiveTrue(id, workspace.getProject().getId())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked task was not found"));
                }
                case BACKLOG_ITEM -> {
                    if (type == ProjectLogType.MEETING_NOTE) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid link type");
                    Long id = Long.valueOf(targetId);
                    SprintBacklog item = backlog.findById(id)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked backlog item was not found"));
                    Sprint sprint = item.getSprint();
                    if (sprint == null || sprint.getProjectId() == null || !sprint.getProjectId().equals(workspace.getProject().getId()))
                        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Linked backlog item is outside this project");
                }
            }
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Linked object ID is invalid");
        }
    }

    private ProjectLog requireLog(Long workspaceId, Long id) {
        return logs.findByIdAndWorkspaceIdAndDeletedFalse(id, workspaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project log was not found"));
    }

    private ProjectLogTargetType parseTargetType(String value) {
        try {
            return ProjectLogTargetType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Linked target type is invalid");
        }
    }

    private jakarta.persistence.criteria.Predicate linkedTargetPredicate(
            Long projectId, String targetType, String targetId,
            jakarta.persistence.criteria.Root<ProjectLog> root,
            jakarta.persistence.criteria.CriteriaBuilder cb) {
        if (targetId == null || targetId.isBlank()) return cb.conjunction();
        if (targetType == null || targetType.isBlank())
            return cb.equal(root.get("targetId"), targetId);
        ProjectLogTargetType selectedType = parseTargetType(targetType);
        jakarta.persistence.criteria.Predicate direct = cb.and(
                cb.equal(root.get("targetType"), selectedType),
                cb.equal(root.get("targetId"), targetId));
        if (selectedType != ProjectLogTargetType.SPRINT) return direct;

        Long sprintId;
        try {
            sprintId = Long.valueOf(targetId);
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Sprint ID is invalid");
        }
        Sprint selectedSprint = sprints.findById(sprintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked sprint was not found"));
        if (projectId == null || !projectId.equals(selectedSprint.getProjectId()))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Linked sprint is outside this project");
        List<String> relatedTaskIds = tasks.findBySprintIdAndIsActiveTrue(sprintId).stream()
                .map(task -> task.getId().toString()).toList();
        List<String> relatedBacklogIds = backlog.findBySprintIdOrderByIdAsc(sprintId).stream()
                .map(item -> item.getId().toString()).toList();
        jakarta.persistence.criteria.Predicate related = cb.disjunction();
        if (!relatedTaskIds.isEmpty()) related = cb.or(related,
                cb.and(cb.equal(root.get("targetType"), ProjectLogTargetType.TASK), root.get("targetId").in(relatedTaskIds)));
        if (!relatedBacklogIds.isEmpty()) related = cb.or(related,
                cb.and(cb.equal(root.get("targetType"), ProjectLogTargetType.BACKLOG_ITEM), root.get("targetId").in(relatedBacklogIds)));
        return cb.or(direct, related);
    }

    private void recordAudit(Context context, ProjectLog log, String action, String before, String after,
                             String correlationId, String ip) {
        ProjectLogAudit audit = new ProjectLogAudit();
        audit.setEventId(UUID.randomUUID().toString());
        audit.setWorkspaceId(context.workspace().getId());
        audit.setProjectId(context.workspace().getProject() == null ? null : context.workspace().getProject().getId());
        audit.setLogId(log.getId());
        audit.setActorId(context.user().getId());
        audit.setTimestamp(Instant.now());
        audit.setCorrelationId(correlationId);
        audit.setIp(ip);
        audit.setAction(action);
        audit.setBeforeJson(before == null ? "null" : before);
        audit.setAfterJson(after);
        audits.save(audit);
    }

    private void recordActivity(Workspace workspace, User actor, String action, String correlationId) {
        WorkspaceActivity activity = new WorkspaceActivity();
        activity.setEventId(UUID.randomUUID().toString());
        activity.setTenantId(workspace.getTenant().getId());
        activity.setActorId(actor.getId());
        activity.setWorkspaceId(workspace.getId());
        activity.setAction(action);
        activity.setCorrelationId(correlationId);
        activity.setOccurredAt(Instant.now());
        activities.save(activity);
    }

    private String snapshot(ProjectLog log) {
        try {
            String authorName = log.getCreatedBy() == null ? "Unknown" :
                    users.findById(log.getCreatedBy()).map(User::getFullName).orElse("Former member");
            return mapper.writeValueAsString(LogResponse.from(log, authorName,
                    attendeeResponses(meetingAttendees.findAllByMeetingNoteId(log.getId()))));
        }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot serialize project log audit snapshot", e); }
    }

    private String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 is unavailable", e); }
    }

    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
