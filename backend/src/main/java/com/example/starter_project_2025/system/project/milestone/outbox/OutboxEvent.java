package com.example.starter_project_2025.system.project.milestone.outbox;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "outbox_events")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OutboxEvent {

    @Id
    @Column(name = "event_id", nullable = false, updatable = false)
    private UUID eventId;

    @Column(name = "aggregate_type", nullable = false, length = 100, updatable = false)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false, updatable = false)
    private UUID aggregateId;

    @Column(name = "event_type", nullable = false, length = 100, updatable = false)
    private String eventType;

    @Lob
    @Column(name = "payload_json", nullable = false, updatable = false)
    private String payloadJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OutboxStatus status;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    public static OutboxEvent milestoneCreated(UUID milestoneId, String payloadJson, Instant now) {
        OutboxEvent event = new OutboxEvent();
        event.eventId = UUID.randomUUID();
        event.aggregateType = "MILESTONE";
        event.aggregateId = milestoneId;
        event.eventType = "MILESTONE_CREATED";
        event.payloadJson = payloadJson;
        event.status = OutboxStatus.PENDING;
        event.attemptCount = 0;
        event.createdAt = now;
        return event;
    }

    public static OutboxEvent milestoneOpened(UUID milestoneId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(milestoneId, payloadJson, now);
        event.eventType = "MILESTONE_OPENED";
        return event;
    }

    public static OutboxEvent milestoneStarted(UUID milestoneId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(milestoneId, payloadJson, now);
        event.eventType = "MILESTONE_STARTED";
        return event;
    }

    public static OutboxEvent milestoneRejected(UUID milestoneId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(milestoneId, payloadJson, now);
        event.eventType = "MILESTONE_REJECTED";
        return event;
    }

    public static OutboxEvent templateSampleContentUpdated(Long tenantId, Long templateId, String payloadJson, Instant now) {
        UUID aggregateId = UUID.nameUUIDFromBytes(("project-template:" + tenantId + ":" + templateId)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
        OutboxEvent event = milestoneCreated(aggregateId, payloadJson, now);
        event.aggregateType = "PROJECT_TEMPLATE";
        event.eventType = "PROJECT_TEMPLATE_SAMPLE_CONTENT_UPDATED";
        return event;
    }

    public static OutboxEvent templateArchived(Long tenantId, Long templateId, String payloadJson, Instant now) {
        OutboxEvent event = templateSampleContentUpdated(tenantId, templateId, payloadJson, now);
        event.eventType = "PROJECT_TEMPLATE_ARCHIVED";
        return event;
    }

    public static OutboxEvent milestoneAtRiskAlert(UUID eventId, UUID milestoneId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(milestoneId, payloadJson, now);
        event.eventId = eventId;
        event.eventType = "MILESTONE_AT_RISK_ALERT_SENT";
        return event;
    }

    public static OutboxEvent projectAlertBatch(UUID batchId, String eventType, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(batchId, payloadJson, now);
        event.eventId = batchId;
        event.aggregateType = "PROJECT_ALERT_BATCH";
        event.eventType = eventType;
        return event;
    }

    public static OutboxEvent inactiveMemberAlertBatch(UUID eventId, Long projectId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(UUID.nameUUIDFromBytes(("project:" + projectId)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8)), payloadJson, now);
        event.eventId = eventId;
        event.aggregateType = "PROJECT";
        event.eventType = "INACTIVE_MEMBER_ALERT_BATCH_SENT";
        return event;
    }

    public static OutboxEvent inactiveMemberAlertBatch(UUID eventId, UUID projectId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(projectId, payloadJson, now);
        event.eventId = eventId;
        event.aggregateType = "PROJECT";
        event.eventType = "INACTIVE_MEMBER_ALERT_BATCH_SENT";
        return event;
    }

    public static OutboxEvent artifactDraftSaved(UUID milestoneId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(milestoneId, payloadJson, now);
        event.aggregateType = "MILESTONE_ARTIFACT_DRAFT";
        event.eventType = "ARTIFACT_DRAFT_SAVED";
        return event;
    }

    public static OutboxEvent artifactFileUploaded(UUID milestoneId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(milestoneId, payloadJson, now);
        event.aggregateType = "MILESTONE_ARTIFACT_DRAFT";
        event.eventType = "ARTIFACT_FILE_UPLOADED";
        return event;
    }

    public static OutboxEvent artifactSubmitted(UUID submissionId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(submissionId, payloadJson, now);
        event.aggregateType = "MILESTONE_ARTIFACT_SUBMISSION";
        event.eventType = "ARTIFACT_SUBMITTED";
        return event;
    }
}
