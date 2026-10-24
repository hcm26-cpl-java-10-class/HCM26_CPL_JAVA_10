package com.example.starter_project_2025.system.project.task.event;

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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TaskOutboxService {

    TaskOutboxRepository outboxRepository;
    ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(
            Long taskId,
            Long projectId,
            Long sprintId,
            Long actorId,
            String correlationId,
            Map<String, Object> taskState
    ) {
        enqueueEvent(taskId, projectId, sprintId, actorId, correlationId, "TASK_CREATED", taskState);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueStatusChanged(
            Long taskId,
            Long projectId,
            Long sprintId,
            Long actorId,
            String correlationId,
            Map<String, Object> statusChange
    ) {
        enqueueEvent(
                taskId,
                projectId,
                sprintId,
                actorId,
                correlationId,
                "fams.kanban.card_moved",
                statusChange
        );
    }

    private void enqueueEvent(
            Long taskId,
            Long projectId,
            Long sprintId,
            Long actorId,
            String correlationId,
            String eventType,
            Map<String, Object> eventState
    ) {
        String dedupeKey = String.join(
                ":",
                "TASK",
                String.valueOf(taskId),
                eventType,
                correlationId
        );
        if (outboxRepository.existsByDedupeKey(dedupeKey)) {
            log.debug("Duplicate Task outbox event ignored: {}", dedupeKey);
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", eventType);
        payload.put("taskId", taskId);
        payload.put("projectId", projectId);
        payload.put("sprintId", sprintId);
        payload.put("actorId", actorId);
        payload.put("occurredAt", LocalDateTime.now());
        payload.put("task", eventState);

        TaskOutboxEvent event = TaskOutboxEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .dedupeKey(dedupeKey)
                .aggregateId(taskId)
                .projectId(projectId)
                .eventType(eventType)
                .payload(toJson(payload))
                .correlationId(correlationId)
                .status(TaskOutboxStatus.PENDING)
                .build();
        outboxRepository.save(event);
        log.info("Task outbox event queued taskId={} eventType={} correlationId={}",
                taskId, eventType, correlationId);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize Task outbox payload", exception);
        }
    }
}
