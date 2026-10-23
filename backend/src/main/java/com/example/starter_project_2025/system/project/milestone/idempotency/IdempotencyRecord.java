package com.example.starter_project_2025.system.project.milestone.idempotency;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "idempotency_records",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_idempotency_scope_key",
                columnNames = {"tenant_id", "actor_id", "operation", "idempotency_key"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class IdempotencyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "idempotency_record_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private UUID actorId;

    @Column(nullable = false, length = 100, updatable = false)
    private String operation;

    @Column(name = "idempotency_key", nullable = false, length = 100, updatable = false)
    private String idempotencyKey;

    @Column(name = "request_hash", nullable = false, length = 64, updatable = false)
    private String requestHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private IdempotencyStatus status;

    @Column(name = "resource_id", nullable = false, updatable = false)
    private UUID resourceId;

    @Column(name = "response_status", nullable = false, updatable = false)
    private int responseStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "completed_at", nullable = false, updatable = false)
    private Instant completedAt;

    public static IdempotencyRecord completed(
            UUID tenantId,
            UUID actorId,
            String operation,
            String key,
            String requestHash,
            UUID resourceId,
            int responseStatus,
            Instant now
    ) {
        IdempotencyRecord record = new IdempotencyRecord();
        record.tenantId = tenantId;
        record.actorId = actorId;
        record.operation = operation;
        record.idempotencyKey = key;
        record.requestHash = requestHash;
        record.status = IdempotencyStatus.COMPLETED;
        record.resourceId = resourceId;
        record.responseStatus = responseStatus;
        record.createdAt = now;
        record.completedAt = now;
        return record;
    }
}
