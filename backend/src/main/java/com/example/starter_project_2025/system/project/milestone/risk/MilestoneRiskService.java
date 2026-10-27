package com.example.starter_project_2025.system.project.milestone.risk;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.audit.*;
import com.example.starter_project_2025.system.project.milestone.outbox.*;
import com.example.starter_project_2025.system.project.milestone.exception.*;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.alert.*;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import static com.example.starter_project_2025.system.project.milestone.risk.MilestoneRiskDtos.*;

@Service @Transactional(readOnly = true)
public class MilestoneRiskService {
    public static final String EVENT_TYPE = "MILESTONE_AT_RISK_ALERT_SENT";
    private final TaskAlertAccess access;
    private final TaskAlertProjectLinkRepository projectLinks;
    private final MilestoneRepository milestones;
    private final TaskRepository tasks;
    private final MilestoneRiskAlertRepository alerts;
    private final OutboxEventRepository outbox;
    private final MilestoneAuditRepository audit;
    private final MilestoneRiskEvaluator evaluator;
    private final Validator validator;
    private final ObjectMapper json;
    private final EntityManager em;
    private final Clock clock;
    public MilestoneRiskService(TaskAlertAccess access, TaskAlertProjectLinkRepository projectLinks,
            MilestoneRepository milestones, TaskRepository tasks, MilestoneRiskAlertRepository alerts,
            OutboxEventRepository outbox, MilestoneAuditRepository audit, MilestoneRiskEvaluator evaluator,
            Validator validator, ObjectMapper json, EntityManager em, @Qualifier("milestoneClock") Clock clock) {
        this.access=access; this.projectLinks=projectLinks; this.milestones=milestones; this.tasks=tasks;
        this.alerts=alerts; this.outbox=outbox; this.audit=audit; this.evaluator=evaluator;
        this.validator=validator; this.json=json; this.em=em; this.clock=clock;
    }
    public Page list(Long projectId, boolean atRiskOnly) {
        UUID legacyProjectId = legacyProjectId(projectId);
        User actor = access.actor("MILESTONE_RISK_READ"); access.project(actor, legacyProjectId, false);
        boolean canSend = access.permitted(actor, "MILESTONE_ALERT_SEND") && access.directory().isManager(legacyProjectId, actor.getId());
        Instant now = clock.instant();
        var content = milestones.findByProjectIdAndTenantIdAndActiveTrueOrderByDeadlineAscIdAsc(projectId, MilestoneRiskIdentity.tenant(actor.getTenant().getId()))
                .stream().map(milestone -> {
                    Progress progress = evaluator.evaluate(milestone,
                            tasks.countByProjectIdAndMilestoneIdAndIsActiveTrueAndStatus(legacyProjectId, milestone.getId(), TaskStatus.DONE),
                            tasks.countByProjectIdAndMilestoneIdAndIsActiveTrue(legacyProjectId, milestone.getId()), now);
                    return new Item(milestone.getId(), milestone.getTitle(), milestone.getStatus(), milestone.getDeadline(),
                            milestone.getVersion(), milestone.isAtRisk(), progress, canSend && progress.eligible());
                }).filter(item -> !atRiskOnly || item.progress().eligible()).toList();
        return new Page(projectId, access.directory().project(legacyProjectId).getName(), actor.getId(), actor.getTenant().getId(),
                canSend, 48, 80, content);
    }
    public List<History> history(Long projectId, UUID milestoneId) {
        User actor = access.actor("MILESTONE_RISK_READ"); access.project(actor, legacyProjectId(projectId), false);
        requireMilestone(projectId, milestoneId, actor);
        return alerts.findByMilestoneIdOrderByCreatedAtDesc(milestoneId).stream()
                .filter(alert -> projectId.equals(alert.getProjectId()) && actor.getTenant().getId().equals(alert.getTenantId()))
                .map(alert -> new History(alert.getId(), alert.getActorId(), alert.getWarningNote(),
                        status(alert), alert.getCreatedAt(), alert.getCorrelationId())).toList();
    }
    @Transactional
    public Result send(Long projectId, UUID milestoneId, UUID key, Send request) {
        UUID legacyProjectId = legacyProjectId(projectId);
        User actor = access.actor("MILESTONE_ALERT_SEND"); access.project(actor, legacyProjectId, true);
        if (key == null) throw validation("idempotencyKey", "Idempotency-Key is required");
        projectLinks.lock(legacyProjectId).orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Project is unavailable"));
        Milestone milestone = milestones.lockForRisk(milestoneId, projectId, MilestoneRiskIdentity.tenant(actor.getTenant().getId()))
                .orElseThrow(this::missing);
        em.refresh(milestone);
        if (!milestone.isActive()) throw missing();
        if (request == null) throw validation("request", "Request is required");
        Map<String,List<String>> errors = new LinkedHashMap<>();
        validator.validate(request).forEach(error -> errors.computeIfAbsent(error.getPropertyPath().toString(), ignored -> new ArrayList<>()).add(error.getMessage()));
        if (!errors.isEmpty()) throw new MilestoneValidationException(errors);
        String hash = fingerprint(projectId, milestoneId, request);
        var previous = alerts.findByActorIdAndRequestId(actor.getId(), key);
        if (previous.isPresent()) {
            if (!previous.get().getRequestHash().equals(hash)) throw new MilestoneConflictException("This Idempotency-Key was used for a different alert");
            return result(previous.get());
        }
        if (milestone.getVersion() != request.version()) throw new MilestoneConflictException("Milestone data has changed. Reload the milestone list.");
        var lockedTasks = tasks.lockProjectTasks(legacyProjectId);
        lockedTasks.forEach(em::refresh);
        var currentTasks = lockedTasks.stream().filter(task -> Boolean.TRUE.equals(task.getIsActive()) && milestoneId.equals(task.getMilestoneId())).toList();
        Instant now = clock.instant();
        Progress progress = evaluator.evaluate(milestone, currentTasks.stream().filter(task -> task.getStatus() == TaskStatus.DONE).count(), currentTasks.size(), now);
        if (!progress.eligible()) throw new MilestoneConflictException("This milestone no longer meets the risk conditions. Reload the milestone list.");
        var recipients = access.directory().studentRecipients(legacyProjectId, actor.getId()).stream().map(User::getId).toList();
        if (recipients.isEmpty()) throw new MilestoneConflictException("The project team has no active student recipients.");
        String correlation = CorrelationIdFilter.currentId();
        if (correlation.length() > 100) throw validation("correlationId", "X-Correlation-ID cannot exceed 100 characters");
        String note = request.warningNote() == null || request.warningNote().isBlank()
                ? "Milestone " + milestone.getTitle() + " is at risk of missing the deadline. Please review your progress." : request.warningNote();
        boolean before = milestone.isAtRisk();
        milestone.markAtRisk(MilestoneRiskIdentity.actor(actor.getId()), now);
        milestones.flush();
        MilestoneRiskAlert alert = new MilestoneRiskAlert();
        alert.setId(UUID.randomUUID()); alert.setMilestoneId(milestoneId); alert.setProjectId(projectId);
        alert.setTenantId(actor.getTenant().getId()); alert.setActorId(actor.getId()); alert.setRequestId(key); alert.setRequestHash(hash);
        alert.setWarningNote(note); alert.setRecipientCount(recipients.size()); alert.setCreatedAt(now); alert.setCorrelationId(correlation);
        alerts.saveAndFlush(alert);
        Event payload = new Event(alert.getId(), EVENT_TYPE, projectId, alert.getTenantId(), milestoneId, milestone.getTitle(),
                actor.getId(), note, recipients, List.of("IN_APP","EMAIL"), progress, now, correlation);
        outbox.saveAndFlush(OutboxEvent.milestoneAtRiskAlert(alert.getId(), milestoneId, encode(payload), now));
        audit.saveAndFlush(MilestoneAuditLog.riskAlerted(milestoneId, projectId, milestone.getTenantId(),
                MilestoneRiskIdentity.actor(actor.getId()), key.toString(), correlation,
                encode(Map.of("actor_id", actor.getId(), "before", Map.of("isAtRisk", before),
                        "after", Map.of("isAtRisk", true), "progress", progress, "event_id", alert.getId())), now));
        return result(alert);
    }
    private Milestone requireMilestone(Long projectId, UUID milestoneId, User actor) {
        return milestones.findByIdAndProjectIdAndTenantId(milestoneId, projectId, MilestoneRiskIdentity.tenant(actor.getTenant().getId()))
                .filter(Milestone::isActive).orElseThrow(this::missing);
    }
    private ResourceNotFoundException missing() { return new ResourceNotFoundException("Milestone does not exist or has been changed"); }
    private MilestoneValidationException validation(String field, String message) { return new MilestoneValidationException(Map.of(field, List.of(message))); }
    private String status(MilestoneRiskAlert alert) { return outbox.findById(alert.getId()).orElseThrow().getStatus().name(); }
    private Result result(MilestoneRiskAlert alert) {
        return new Result(alert.getId(), alert.getId(), alert.getMilestoneId(), true, alert.getRecipientCount(), status(alert), alert.getCreatedAt(), alert.getCorrelationId());
    }
    private String fingerprint(Long projectId, UUID milestoneId, Send request) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(
                encode(List.of(projectId, milestoneId, request.version(), request.warningNote() == null ? "" : request.warningNote())).getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    private UUID legacyProjectId(Long projectId) {
        return UUID.nameUUIDFromBytes(("milestone:project:" + projectId).getBytes(StandardCharsets.UTF_8));
    }
    private String encode(Object value) {
        try { return json.writeValueAsString(value); }
        catch (com.fasterxml.jackson.core.JsonProcessingException exception) { throw new IllegalStateException("Unable to serialize milestone risk alert", exception); }
    }
}
