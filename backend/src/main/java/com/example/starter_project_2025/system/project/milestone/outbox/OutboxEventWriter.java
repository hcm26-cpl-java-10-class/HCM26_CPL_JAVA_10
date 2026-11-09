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
            payload.put("rubricSnapshotId", milestone.getRubricSnapshotId());
            payload.put("weight", milestone.getWeight());
            payload.put("latePenaltyBasis", milestone.getLatePenaltyBasis());
            payload.put("occurredAt", now);
            repository.save(OutboxEvent.milestoneCreated(
                    milestone.getId(), objectMapper.writeValueAsString(payload), now
            ));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize milestone outbox event", ex);
        }
    }

    public void writeMilestoneOpened(Milestone milestone, Instant now) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("milestoneId", milestone.getId()); payload.put("projectId", milestone.getProjectId());
            payload.put("teamId", milestone.getTeamId()); payload.put("tenantId", milestone.getTenantId());
            payload.put("actorId", milestone.getUpdatedBy()); payload.put("status", milestone.getStatus());
            payload.put("lifecycleStatus", milestone.lifecycleStatus());
            payload.put("occurredAt", now);
            repository.save(OutboxEvent.milestoneOpened(milestone.getId(), objectMapper.writeValueAsString(payload), now));
        } catch (JsonProcessingException ex) { throw new IllegalStateException("Unable to serialize milestone open event", ex); }
    }

    public void writeMilestoneStarted(Milestone milestone, Instant now) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("milestoneId", milestone.getId());
            payload.put("projectId", milestone.getProjectId());
            payload.put("teamId", milestone.getTeamId());
            payload.put("tenantId", milestone.getTenantId());
            payload.put("actorId", milestone.getUpdatedBy());
            payload.put("lifecycleStatus", milestone.lifecycleStatus());
            payload.put("occurredAt", now);
            repository.save(OutboxEvent.milestoneStarted(milestone.getId(), objectMapper.writeValueAsString(payload), now));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize milestone start event", ex);
        }
    }

    public void writeMilestoneRejected(Milestone milestone, String reason, Instant now) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("milestoneId", milestone.getId());
            payload.put("projectId", milestone.getProjectId());
            payload.put("teamId", milestone.getTeamId());
            payload.put("tenantId", milestone.getTenantId());
            payload.put("lifecycleStatus", milestone.lifecycleStatus());
            payload.put("reason", reason);
            payload.put("severity", "HIGH");
            payload.put("occurredAt", now);
            repository.save(OutboxEvent.milestoneRejected(milestone.getId(), objectMapper.writeValueAsString(payload), now));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize milestone rejection event", ex);
        }
    }

    public void writeArtifactDraftSaved(java.util.UUID milestoneId, Long projectId,
            Long tenantId, java.util.UUID actorId, long version, Instant now) {
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

    public void writeArtifactFileUploaded(java.util.UUID milestoneId, Long projectId,
            Long tenantId, java.util.UUID actorId, java.util.UUID attachmentId, Instant now) {
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
            Long projectId, Long tenantId, java.util.UUID actorId,
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
