package com.example.starter_project_2025.system.project.milestone.audit;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class MilestoneAuditWriter {

    private final MilestoneAuditRepository repository;
    private final ObjectMapper objectMapper;

    public void writeCreated(Milestone milestone, UUID actorId, String idempotencyKey, Instant now) {
        try {
            String details = objectMapper.writeValueAsString(Map.of(
                    "title", milestone.getTitle(),
                    "deadline", milestone.getDeadline().toString(),
                    "checklistItemCount", milestone.getChecklistItems().size()
            ));
            repository.save(MilestoneAuditLog.created(
                    milestone.getId(), milestone.getProjectId(), milestone.getTenantId(), actorId,
                    idempotencyKey, details, now
            ));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize milestone audit", ex);
        }
    }
}
