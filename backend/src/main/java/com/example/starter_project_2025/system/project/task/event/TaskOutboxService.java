package com.example.starter_project_2025.system.project.task.event;

import com.example.starter_project_2025.system.project.task.TaskConflictException;
import com.example.starter_project_2025.system.project.task.TaskDTO;
import com.example.starter_project_2025.system.project.task.TaskRequestContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class TaskOutboxService {
    private final TaskOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;

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
            byte[] json = objectMapper.writeValueAsString(values).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json));
        } catch (JsonProcessingException | NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Không thể xác định yêu cầu Task", ex);
        }
    }

    public Optional<TaskDTO> findReplay(Long actorId, TaskRequestContext context, String requestHash) {
        return outboxRepository.findByActorIdAndRequestId(actorId, context.requestId()).map(event -> {
            if (!event.getRequestHash().equals(requestHash)) {
                throw new TaskConflictException("Idempotency-Key đã được dùng cho yêu cầu khác");
            }
            try {
                return objectMapper.readValue(event.getPayload(), TaskDTO.class);
            } catch (JsonProcessingException ex) {
                throw new IllegalStateException("Không thể đọc kết quả Task đã lưu", ex);
            }
        });
    }

    public void enqueue(String eventType, TaskDTO task, Long actorId,
                        TaskRequestContext context, String requestHash) {
        try {
            outboxRepository.save(TaskOutboxEvent.builder()
                    .taskId(task.getId()).projectId(task.getProjectId()).actorId(actorId)
                    .eventType(eventType).requestId(context.requestId()).requestHash(requestHash)
                    .correlationId(context.correlationId()).payload(objectMapper.writeValueAsString(task)).build());
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Không thể lưu sự kiện Task", ex);
        }
    }
}
