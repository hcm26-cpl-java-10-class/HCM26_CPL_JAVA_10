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

    public static OutboxEvent milestoneAtRiskAlert(UUID eventId, UUID milestoneId, String payloadJson, Instant now) {
        OutboxEvent event = milestoneCreated(milestoneId, payloadJson, now);
        event.eventId = eventId;
        event.eventType = "MILESTONE_AT_RISK_ALERT_SENT";
        return event;
    }
}
