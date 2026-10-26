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

    public void writeArtifactDraftSaved(java.util.UUID milestoneId, java.util.UUID projectId,
            java.util.UUID tenantId, java.util.UUID actorId, long version, Instant now) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("milestoneId", milestoneId);
            payload.put("projectId", projectId);
            payload.put("tenantId", tenantId);
            payload.put("actorId", actorId);
            payload.put("version", version);
            payload.put("occurredAt", now);
            repository.save(OutboxEvent.artifactDraftSaved(milestoneId,
                    objectMapper.writeValueAsString(payload), now));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize artifact draft event", ex);
        }
    }

    public void writeArtifactFileUploaded(java.util.UUID milestoneId, java.util.UUID projectId,
            java.util.UUID tenantId, java.util.UUID actorId, java.util.UUID attachmentId, Instant now) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("milestoneId", milestoneId);
            payload.put("projectId", projectId);
            payload.put("tenantId", tenantId);
            payload.put("actorId", actorId);
            payload.put("attachmentId", attachmentId);
            payload.put("occurredAt", now);
            repository.save(OutboxEvent.artifactFileUploaded(milestoneId,
                    objectMapper.writeValueAsString(payload), now));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize artifact upload event", ex);
        }
    }

    public void writeArtifactSubmitted(java.util.UUID submissionId, java.util.UUID milestoneId,
            java.util.UUID projectId, java.util.UUID tenantId, java.util.UUID actorId,
            long version, boolean submittedLate, Instant now) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("submissionId", submissionId);
            payload.put("milestoneId", milestoneId);
            payload.put("projectId", projectId);
            payload.put("tenantId", tenantId);
            payload.put("actorId", actorId);
            payload.put("version", version);
            payload.put("status", "SUBMITTED");
            payload.put("submittedLate", submittedLate);
            payload.put("occurredAt", now);
            repository.save(OutboxEvent.artifactSubmitted(submissionId,
                    objectMapper.writeValueAsString(payload), now));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize artifact submission event", ex);
        }
    }
}
