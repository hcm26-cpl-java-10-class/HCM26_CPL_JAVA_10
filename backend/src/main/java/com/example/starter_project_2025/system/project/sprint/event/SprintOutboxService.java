package com.example.starter_project_2025.system.project.sprint.event;

import com.example.starter_project_2025.system.project.sprint.SprintCorrelationIds;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Appends sprint domain events to the transactional outbox.
 * <p>
 * Rows are written in the same transaction as the sprint mutation, so either
 * both the business data and the event exist, or neither does. Duplicate
 * emissions for the same aggregate/action/correlation triple are ignored,
 * making publishing idempotent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintOutboxService {

    public static final String AGGREGATE_TYPE = "SPRINT";

    SprintOutboxRepository outboxRepository;
    ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(String eventType, Long sprintId, Long projectId, String actorEmail, Object payload) {

        String correlationId = SprintCorrelationIds.current();

        String dedupeKey = String.join(":",
                AGGREGATE_TYPE,
                String.valueOf(sprintId),
                eventType,
                correlationId);

        if (outboxRepository.existsByDedupeKey(dedupeKey)) {
            log.debug("[SPRINT-OUTBOX] duplicate event ignored: {}", dedupeKey);
            return;
        }

        SprintOutboxEvent event = SprintOutboxEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .dedupeKey(dedupeKey)
                .aggregateType(AGGREGATE_TYPE)
                .aggregateId(sprintId)
                .eventType(eventType)
                .correlationId(correlationId)
                .payload(toJson(SprintNotificationPayload.of(
                        eventType, sprintId, projectId, actorEmail, payload
                )))
                .status(SprintOutboxStatus.PENDING)
                .build();

        outboxRepository.save(event);

        log.info("[SPRINT-OUTBOX] event queued type={} sprintId={} correlationId={}",
                eventType, sprintId, correlationId);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialise sprint outbox payload", ex);
        }
    }

    /**
     * Payload delivered to the notification pipeline (team members).
     */
    record SprintNotificationPayload(
            String eventType,
            Long sprintId,
            Long projectId,
            String actorEmail,
            String channel,
            LocalDateTime occurredAt,
            Object data
    ) {
        static SprintNotificationPayload of(String eventType,
                                            Long sprintId,
                                            Long projectId,
                                            String actorEmail,
                                            Object data) {
            return new SprintNotificationPayload(
                    eventType,
                    sprintId,
                    projectId,
                    actorEmail,
                    "TEAM_MEMBERS",
                    LocalDateTime.now(),
                    data
            );
        }
    }
}
