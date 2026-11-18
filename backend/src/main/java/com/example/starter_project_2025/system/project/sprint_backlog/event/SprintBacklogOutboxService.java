package com.example.starter_project_2025.system.project.sprint_backlog.event;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.sprint.SprintCorrelationIds;
import com.example.starter_project_2025.system.project.sprint.event.SprintOutboxEvent;
import com.example.starter_project_2025.system.project.sprint.event.SprintOutboxRepository;
import com.example.starter_project_2025.system.project.sprint.event.SprintOutboxStatus;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Appends sprint backlog domain events to the transactional outbox
 * (UFR-PRJ-003-02: "phát Outbox Event thông báo cho nhóm").
 * <p>
 * The rows reuse the sprint outbox table ({@code sprint_outbox_event}) so the
 * existing {@code SprintOutboxRelay} publishes them with no extra wiring: the
 * business mutation and its notification event are committed atomically, and
 * the dedupe key keeps publishing idempotent per aggregate/action/correlation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintBacklogOutboxService {

    public static final String AGGREGATE_TYPE = "SPRINT_BACKLOG";

    SprintOutboxRepository outboxRepository;
    ObjectMapper objectMapper;

    /**
     * @param eventType event name, e.g. {@code SPRINT_BACKLOG_ITEM_CREATED}
     * @param backlogId id of the backlog item (outbox aggregate id)
     * @param projectId owning project, used by the notification pipeline
     * @param payload   after-state snapshot of the item
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(String eventType, Long backlogId, Long projectId, Object payload) {

        String correlationId = SprintCorrelationIds.current();

        String dedupeKey = String.join(":",
                AGGREGATE_TYPE,
                String.valueOf(backlogId),
                eventType,
                correlationId);

        if (outboxRepository.existsByDedupeKey(dedupeKey)) {
            log.debug("[SPRINT-BACKLOG-OUTBOX] duplicate event ignored: {}", dedupeKey);
            return;
        }

        SprintOutboxEvent event = SprintOutboxEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .dedupeKey(dedupeKey)
                .aggregateType(AGGREGATE_TYPE)
                .aggregateId(backlogId)
                .eventType(eventType)
                .correlationId(correlationId)
                .payload(toJson(new BacklogNotificationPayload(
                        eventType,
                        backlogId,
                        projectId,
                        currentActorEmail(),
                        "TEAM_MEMBERS",
                        LocalDateTime.now(),
                        payload
                )))
                .status(SprintOutboxStatus.PENDING)
                .build();

        outboxRepository.save(event);

        log.info("[SPRINT-BACKLOG-OUTBOX] event queued type={} backlogId={} correlationId={}",
                eventType, backlogId, correlationId);
    }

    private String toJson(Object value) {

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialise sprint backlog outbox payload", ex);
        }
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

    /**
     * Payload delivered to the notification pipeline (team members).
     */
    record BacklogNotificationPayload(
            String eventType,
            Long sprintBacklogId,
            Long projectId,
            String actorEmail,
            String channel,
            LocalDateTime occurredAt,
            Object data
    ) {
    }
}
