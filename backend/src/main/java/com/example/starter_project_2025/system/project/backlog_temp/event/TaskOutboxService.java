package com.example.starter_project_2025.system.project.backlog_temp.event;

import com.example.starter_project_2025.system.project.backlog_temp.TaskCorrelationIds;
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
 * Appends backlog item domain events to the transactional outbox.
 * <p>
 * Rows are written in the same transaction as the backlog mutation, so either
 * both the business data and the notification event exist, or neither does.
 * Duplicate emissions for the same aggregate/action/correlation triple are
 * ignored, making publishing idempotent.
 */
@Slf4j
@Service("backlogItemOutboxService")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TaskOutboxService {

    public static final String AGGREGATE_TYPE = "BACKLOG_ITEM";

    TaskOutboxRepository outboxRepository;
    ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(String eventType, Long taskId, Long projectId, String actorEmail, Object payload) {

        String correlationId = TaskCorrelationIds.current();

        String dedupeKey = String.join(":",
                AGGREGATE_TYPE,
                String.valueOf(taskId),
                eventType,
                correlationId);

        if (outboxRepository.existsByDedupeKey(dedupeKey)) {
            log.debug("[TASK-OUTBOX] duplicate event ignored: {}", dedupeKey);
            return;
        }

        TaskOutboxEvent event = TaskOutboxEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .dedupeKey(dedupeKey)
                .aggregateType(AGGREGATE_TYPE)
                .aggregateId(taskId)
                .eventType(eventType)
                .correlationId(correlationId)
                .payload(toJson(BacklogNotificationPayload.of(
                        eventType, taskId, projectId, actorEmail, payload
                )))
                .status(TaskOutboxStatus.PENDING)
                .build();

        outboxRepository.save(event);

        log.info("[TASK-OUTBOX] event queued type={} taskId={} correlationId={}",
                eventType, taskId, correlationId);
    }

    private String toJson(Object value) {

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialise backlog item outbox payload", ex);
        }
    }

    /**
     * Payload delivered to the notification pipeline (team members).
     */
    record BacklogNotificationPayload(
            String eventType,
            Long taskId,
            Long projectId,
            String actorEmail,
            String channel,
            LocalDateTime occurredAt,
            Object data
    ) {
        static BacklogNotificationPayload of(String eventType,
                                             Long taskId,
                                             Long projectId,
                                             String actorEmail,
                                             Object data) {
            return new BacklogNotificationPayload(
                    eventType,
                    taskId,
                    projectId,
                    actorEmail,
                    "TEAM_MEMBERS",
                    LocalDateTime.now(),
                    data
            );
        }
    }
}
