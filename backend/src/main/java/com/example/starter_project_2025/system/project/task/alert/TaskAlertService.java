package com.example.starter_project_2025.system.project.task.alert;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import static com.example.starter_project_2025.system.project.task.alert.TaskAlertDtos.*;
import static com.example.starter_project_2025.system.project.task.alert.TaskAlertData.*;

@Service @Transactional(readOnly = true)
public class TaskAlertService {
    public static final String EVENT_TYPE = "TASK_OVERDUE_ALERT_BATCH_SENT";
    private final TaskAlertAccess access;
    private final TaskRepository tasks;
    private final TaskMapper mapper;
    private final TaskAlertProjectLinkRepository projects;
    private final TaskAlertBatchRepository batches;
    private final TaskAlertItemRepository items;
    private final TaskAlertOutboxRepository outbox;
    private final TaskAuditService audit;
    private final Validator validator;
    private final ObjectMapper json;
    private final EntityManager em;
    private final Clock clock;
    public TaskAlertService(TaskAlertAccess access, TaskRepository tasks, TaskMapper mapper,
            TaskAlertProjectLinkRepository projects, TaskAlertBatchRepository batches,
            TaskAlertItemRepository items, TaskAlertOutboxRepository outbox, TaskAuditService audit,
            Validator validator, ObjectMapper json, EntityManager em, @Qualifier("taskAlertClock") Clock clock) {
        this.access = access; this.tasks = tasks; this.mapper = mapper; this.projects = projects;
        this.batches = batches; this.items = items; this.outbox = outbox; this.audit = audit;
        this.validator = validator; this.json = json; this.em = em; this.clock = clock;
    }
    public OverduePage overdue(UUID projectId, int page, int size) {
        User actor = access.actor("TASK_READ"); access.project(actor, projectId, false);
        if (page < 0 || size < 1 || size > 100) throw new TaskValidationException("page", "Use page >= 0 and size between 1 and 100");
        Instant now = clock.instant();
        Specification<Task> spec = (root, query, cb) -> cb.and(
                cb.equal(root.get("projectId"), projectId), cb.isTrue(root.get("isActive")),
                root.get("status").in(TaskStatus.TODO, TaskStatus.IN_PROGRESS),
                cb.isNotNull(root.get("deadline")), cb.lessThan(root.get("deadline"), now));
        // Apply the authoritative team scope before pagination; no foreign-team totals leak.
        var visible = tasks.findAll(spec, Sort.by("deadline", "id")).stream()
                .filter(task -> access.directory().canRead(actor, task)).toList();
        boolean canSend = access.permitted(actor, "TASK_ALERT_SEND") && access.directory().isManager(projectId, actor.getId());
        int from = (int) Math.min((long) page * size, visible.size());
        int to = Math.min(from + size, visible.size());
        return new OverduePage(visible.subList(from, to).stream().map(task ->
                new View(mapper.toResponse(task), canSend && access.directory().canSend(actor, task))).toList(),
                visible.size(), page, size, canSend);
    }
    public List<History> history(UUID taskId) {
        User actor = access.actor("TASK_READ");
        Task task = tasks.findByIdAndIsActiveTrue(taskId).orElseThrow(() -> new ResourceNotFoundException("Task is unavailable"));
        access.read(actor, task);
        return items.findByTaskIdOrderByBatchCreatedAtDesc(taskId).stream().map(item -> {
            var batch = item.getBatch();
            var event = outbox.findByBatchId(batch.getId()).orElseThrow();
            return new History(batch.getId(), batch.getActorId(), batch.getWarningNote(), event.getStatus(),
                    batch.getCreatedAt(), batch.getCorrelationId());
        }).toList();
    }
    @Transactional
    public Result send(Send request, UUID requestId, String correlationId) {
        User actor = access.actor("TASK_ALERT_SEND");
        if (requestId == null) throw new TaskValidationException("idempotencyKey", "Idempotency-Key is required");
        var context = TaskRequestContext.create(requestId, correlationId);
        if (request == null) throw new TaskValidationException("request", "Request is required");
        if (request.projectId() != null) access.project(actor, request.projectId(), true);
        validate(request);
        access.project(actor, request.projectId(), true);
        // Same-project requests serialize here; this also protects two retries with the same key.
        projects.lock(request.projectId()).orElseThrow(() -> new AccessDeniedException("Task project is unavailable"));
        String fingerprint = fingerprint(request);
        var previous = batches.findByActorIdAndRequestId(actor.getId(), requestId);
        if (previous.isPresent()) {
            if (!previous.get().getRequestHash().equals(fingerprint))
                throw new TaskConflictException("This Idempotency-Key was already used for a different alert");
            return result(previous.get());
        }
        var selected = request.tasks().stream().sorted(Comparator.comparing(Selection::taskId)).toList();
        if (selected.stream().map(Selection::taskId).distinct().count() != selected.size())
            throw new TaskValidationException("tasks", "Select each task once");
        // Reuse the lock order used by TaskWorkflowService to avoid races with status changes.
        var locked = tasks.lockProjectTasks(request.projectId());
        Map<UUID, Task> byId = new HashMap<>();
        locked.forEach(task -> { em.refresh(task); byId.put(task.getId(), task); });
        Instant now = clock.instant();
        List<Task> accepted = new ArrayList<>();
        List<TaskAlertProjectBridge.Member> recipients = new ArrayList<>();
        for (Selection selection : selected) {
            Task task = byId.get(selection.taskId());
            if (task == null) throw new AccessDeniedException("A selected task is outside the project scope");
            access.read(actor, task);
            access.send(actor, task);
            if (!Boolean.TRUE.equals(task.getIsActive()) || !overdue(task, now)
                    || !Objects.equals(task.getVersion(), selection.version()))
                throw new TaskConflictException("Task data or status has changed. Reload the task list.");
            var member = access.directory().recipient(request.projectId(), task.getAssigneeProjectMemberId())
                    .orElseThrow(() -> new TaskConflictException("A selected task has no active assignee. Reload the task list."));
            accepted.add(task); recipients.add(member);
        }
        Map<Long, List<UUID>> grouped = new LinkedHashMap<>();
        for (int i = 0; i < accepted.size(); i++)
            grouped.computeIfAbsent(recipients.get(i).user().getId(), ignored -> new ArrayList<>()).add(accepted.get(i).getId());
        Batch batch = new Batch();
        batch.setId(UUID.randomUUID()); batch.setProjectId(request.projectId());
        batch.setTenantId(actor.getTenant().getId()); batch.setActorId(actor.getId());
        batch.setRequestId(requestId); batch.setRequestHash(fingerprint); batch.setWarningNote(request.warningNote());
        batch.setCorrelationId(context.correlationId()); batch.setCreatedAt(now);
        batch.setTaskCount(accepted.size()); batch.setRecipientCount(grouped.size());
        batches.saveAndFlush(batch);
        List<EventTask> eventTasks = new ArrayList<>();
        for (int i = 0; i < accepted.size(); i++) {
            Task task = accepted.get(i); var member = recipients.get(i);
            Item item = new Item(); item.setId(UUID.randomUUID()); item.setBatch(batch); item.setTaskId(task.getId());
            item.setAssigneeId(member.alias()); item.setRecipientUserId(member.user().getId()); items.save(item);
            TaskDTO snapshot = mapper.toResponse(task);
            // The task itself stays unchanged. The note is retained in the immutable alert batch.
            audit.record("OVERDUE_ALERT_QUEUED", snapshot, snapshot, actor.getId(), context.correlationId());
            eventTasks.add(new EventTask(task.getId(), member.alias(), task.getTitle(), task.getDeadline()));
        }
        Event payload = new Event(batch.getId(), EVENT_TYPE, request.projectId(), batch.getTenantId(), actor.getId(),
                request.warningNote(), accepted.stream().map(Task::getId).toList(),
                recipients.stream().map(TaskAlertProjectBridge.Member::alias).distinct().toList(),
                eventTasks, grouped.entrySet().stream().map(entry -> new Recipient(entry.getKey(), entry.getValue())).toList(),
                List.of("IN_APP", "EMAIL"), now, context.correlationId());
        Outbox event = new Outbox(); event.setId(batch.getId()); event.setBatch(batch); event.setEventType(EVENT_TYPE);
        event.setPayload(encode(payload)); event.setStatus(DeliveryStatus.PENDING); event.setCreatedAt(now);
        outbox.saveAndFlush(event);
        return result(batch);
    }
    private boolean overdue(Task task, Instant now) {
        return (task.getStatus() == TaskStatus.TODO || task.getStatus() == TaskStatus.IN_PROGRESS)
                && task.getDeadline() != null && task.getDeadline().isBefore(now);
    }
    private void validate(Send request) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        validator.validate(request).forEach(error -> errors.computeIfAbsent(
                error.getPropertyPath().toString().startsWith("tasks") ? "tasks" : error.getPropertyPath().toString(),
                ignored -> new ArrayList<>()).add(error.getMessage()));
        if (!errors.isEmpty()) throw new TaskValidationException(errors);
    }
    private String fingerprint(Send request) {
        var normalized = new Send(request.projectId(), request.tasks().stream()
                .sorted(Comparator.comparing(Selection::taskId)).toList(), request.warningNote());
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(encode(normalized).getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    private String encode(Object value) {
        try { return json.writeValueAsString(value); }
        catch (com.fasterxml.jackson.core.JsonProcessingException exception) { throw new IllegalStateException("Unable to serialize task alert", exception); }
    }
    private Result result(Batch batch) {
        return new Result(batch.getId(), batch.getId(), batch.getProjectId(), batch.getTaskCount(), batch.getRecipientCount(),
                outbox.findByBatchId(batch.getId()).map(Outbox::getStatus).orElse(DeliveryStatus.PENDING),
                batch.getCreatedAt(), batch.getCorrelationId());
    }
}
