package com.example.starter_project_2025.system.project.task.event;

import com.example.starter_project_2025.system.project.task.TaskConflictException;
import com.example.starter_project_2025.system.project.task.TaskDTO;
import com.example.starter_project_2025.system.project.task.TaskRequestContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Transactional(propagation = Propagation.MANDATORY)
public class TaskOutboxService {

    BoardTaskOutboxRepository boardOutboxRepository;
    TaskOutboxRepository taskOutboxRepository;
    ObjectMapper objectMapper;

    // The existing Board uses Long task IDs and a deduplicated delivery outbox.
    public void enqueue(
            Long taskId,
            Long projectId,
            Long sprintId,
            Long actorId,
            String correlationId,
            Map<String, Object> taskState
    ) {
        enqueueBoardEvent(taskId, projectId, sprintId, actorId, correlationId,
                "TASK_CREATED", taskState);
    }

    public void enqueueStatusChanged(
            Long taskId,
            Long projectId,
            Long sprintId,
            Long actorId,
            String correlationId,
            Map<String, Object> statusChange
    ) {
        enqueueBoardEvent(taskId, projectId, sprintId, actorId, correlationId,
                "fams.kanban.card_moved", statusChange);
    }

    private void enqueueBoardEvent(
            Long taskId,
            Long projectId,
            Long sprintId,
            Long actorId,
            String correlationId,
            String eventType,
            Map<String, Object> eventState
    ) {
        String dedupeKey = String.join(":", "TASK", String.valueOf(taskId),
                eventType, correlationId);
        if (boardOutboxRepository.existsByDedupeKey(dedupeKey)) {
            log.debug("Duplicate Board Task outbox event ignored: {}", dedupeKey);
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

        BoardTaskOutboxEvent event = BoardTaskOutboxEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .dedupeKey(dedupeKey)
                .aggregateId(taskId)
                .projectId(projectId)
                .eventType(eventType)
                .payload(toJson(payload))
                .correlationId(correlationId)
                .status(TaskOutboxStatus.PENDING)
                .build();
        boardOutboxRepository.save(event);
    }

    // The group Task CRUD uses UUID task IDs and request-key replay records.
    public String requestHash(String action, UUID taskId, TaskDTO request) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("action", action);
        values.put("taskId", taskId);
        values.put("projectId", request.getProjectId());
        values.put("sprintId", request.getSprintId());
        values.put("milestoneId", request.getMilestoneId());
        values.put("assigneeProjectMemberId", request.getAssigneeProjectMemberId());
        values.put("title", request.getTitle());
        values.put("description", request.getDescription());
        values.put("estimatedHours", request.getEstimatedHours());
        values.put("priority", request.getPriority());
        values.put("status", request.getStatus());
        values.put("tags", request.getTags());
        values.put("version", request.getVersion());
        return hash(values);
    }

    public String requestHash(String action, UUID taskId, Object request) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("action", action);
        values.put("taskId", taskId);
        values.put("request", request);
        return hash(values);
    }

    private String hash(Object values) {
        try {
            byte[] json = objectMapper.writeValueAsString(values)
                    .getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(json));
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Unable to identify task request", exception);
        }
    }

    public Optional<TaskDTO> findReplay(
            Long actorId,
            TaskRequestContext context,
            String requestHash
    ) {
        return taskOutboxRepository
                .findByActorIdAndRequestId(actorId, context.requestId())
                .map(event -> {
                    if (!event.getRequestHash().equals(requestHash)) {
                        throw new TaskConflictException(
                                "This Idempotency-Key has already been used for a different request");
                    }
                    try {
                        return objectMapper.readValue(event.getPayload(), TaskDTO.class);
                    } catch (JsonProcessingException exception) {
                        throw new IllegalStateException(
                                "Unable to read saved task result", exception);
                    }
                });
    }

    public void enqueue(
            String eventType,
            TaskDTO task,
            Long actorId,
            TaskRequestContext context,
            String requestHash
    ) {
        try {
            taskOutboxRepository.save(TaskOutboxEvent.builder()
                    .taskId(task.getId())
                    .projectId(task.getProjectId())
                    .actorId(actorId)
                    .eventType(eventType)
                    .requestId(context.requestId())
                    .requestHash(requestHash)
                    .correlationId(context.correlationId())
                    .payload(objectMapper.writeValueAsString(task))
                    .status(TaskOutboxStatus.PENDING)
                    .build());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to save task event", exception);
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Unable to serialize Board Task outbox payload", exception);
        }
    }
}
