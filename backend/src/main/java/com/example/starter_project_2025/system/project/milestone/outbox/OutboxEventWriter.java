package com.example.starter_project_2025.system.project.milestone.outbox;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class OutboxEventWriter {

    private final OutboxEventRepository repository;
    private final ObjectMapper objectMapper;

    public void writeMilestoneCreated(Milestone milestone, Instant now) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("milestoneId", milestone.getId());
            payload.put("projectId", milestone.getProjectId());
            payload.put("tenantId", milestone.getTenantId());
            payload.put("deadline", milestone.getDeadline());
            payload.put("occurredAt", now);
            repository.save(OutboxEvent.milestoneCreated(
                    milestone.getId(), objectMapper.writeValueAsString(payload), now
            ));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize milestone outbox event", ex);
        }
    }
}
