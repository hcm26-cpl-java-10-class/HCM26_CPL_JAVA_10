package com.example.starter_project_2025.system.project.milestone.audit;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class MilestoneAuditWriter {

    private final MilestoneAuditRepository repository;
    private final ObjectMapper objectMapper;

    public void writeCreated(Milestone milestone, UUID actorId, String idempotencyKey, Instant now) {
        try {
            Map<String, Object> state = new LinkedHashMap<>();
            state.put("title", milestone.getTitle());
            state.put("deadline", milestone.getDeadline());
            state.put("checklistItemCount", milestone.getChecklistItems().size());
            state.put("rubricSnapshotId", milestone.getRubricSnapshotId());
            state.put("weight", milestone.getWeight());
            state.put("latePenaltyBasis", milestone.getLatePenaltyBasis());
            String details = objectMapper.writeValueAsString(state);
            repository.save(MilestoneAuditLog.created(
                    milestone.getId(), milestone.getProjectId(), milestone.getTenantId(), actorId,
                    idempotencyKey, details, now
            ));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize milestone audit", ex);
        }
    }
}
