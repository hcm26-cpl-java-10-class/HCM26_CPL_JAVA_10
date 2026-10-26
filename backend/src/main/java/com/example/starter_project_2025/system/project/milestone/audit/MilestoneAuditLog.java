package com.example.starter_project_2025.system.project.milestone.audit;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "milestone_audit_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MilestoneAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "audit_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "milestone_id", nullable = false, updatable = false)
    private UUID milestoneId;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private UUID actorId;

    @Column(nullable = false, length = 50, updatable = false)
    private String action;

    @Column(name = "idempotency_key", length = 100, updatable = false)
    private String idempotencyKey;

    @Column(name = "correlation_id", length = 100, updatable = false)
    private String correlationId;

    @Lob
    @Column(name = "details_json", updatable = false)
    private String detailsJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static MilestoneAuditLog created(
            UUID milestoneId,
            UUID projectId,
            UUID tenantId,
            UUID actorId,
            String idempotencyKey,
            String detailsJson,
            Instant now
    ) {
        MilestoneAuditLog log = new MilestoneAuditLog();
        log.milestoneId = milestoneId;
        log.projectId = projectId;
        log.tenantId = tenantId;
        log.actorId = actorId;
        log.action = "MILESTONE_CREATED";
        log.idempotencyKey = idempotencyKey;
        log.detailsJson = detailsJson;
        log.createdAt = now;
        return log;
    }

    public static MilestoneAuditLog riskAlerted(UUID milestoneId, UUID projectId, UUID tenantId, UUID actorId,
            String key, String correlationId, String details, Instant now) {
        MilestoneAuditLog log = created(milestoneId, projectId, tenantId, actorId, key, details, now);
        log.action = "MILESTONE_AT_RISK_ALERT_SENT";
        log.correlationId = correlationId;
        return log;
    }
}
