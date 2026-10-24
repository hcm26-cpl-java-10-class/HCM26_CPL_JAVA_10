package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(
        name = "idempotency_records",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_idempotency_actor_operation_key",
                columnNames = {"actor_id", "operation", "idempotency_key"}
        )
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class IdempotencyRecord extends BaseEntity {

    @Column(name = "actor_id", nullable = false)
    Long actorId;

    @Column(nullable = false, length = 100)
    String operation;

    @Column(name = "idempotency_key", nullable = false, length = 128)
    String idempotencyKey;

    @Column(name = "request_hash", nullable = false, length = 64)
    String requestHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    IdempotencyStatus status;

    @Column(name = "http_status")
    Integer httpStatus;

    @Column(name = "response_body", columnDefinition = "TEXT")
    String responseBody;

    @Column(name = "expires_at", nullable = false)
    Instant expiresAt;
}