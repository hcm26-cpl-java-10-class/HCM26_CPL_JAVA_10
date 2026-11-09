package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "milestone_submission_outbox", indexes = {
        @Index(name = "idx_submission_outbox_status", columnList = "status,created_at")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SubmissionOutboxEvent {
    @Id
    @Column(name = "event_id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "aggregate_id", nullable = false, updatable = false)
    private UUID aggregateId;
    @Column(name = "event_type", nullable = false, length = 80)
    private String eventType;
    @Column(nullable = false, length = 20)
    private String status;
    @Lob @Column(nullable = false)
    private String payload;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static SubmissionOutboxEvent create(UUID submissionId, String eventType, UUID studentId,
                                               UUID milestoneId, Instant now) {
        SubmissionOutboxEvent value = new SubmissionOutboxEvent();
        value.id = UUID.randomUUID();
        value.aggregateId = submissionId;
        value.eventType = eventType;
        value.status = "PENDING";
        value.payload = "{\"submissionId\":\"" + submissionId + "\",\"milestoneId\":\""
                + milestoneId + "\",\"recipientId\":\"" + studentId + "\"}";
        value.createdAt = now;
        return value;
    }
}
