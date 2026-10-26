package com.example.starter_project_2025.system.project.milestone.idempotency;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface IdempotencyRepository extends JpaRepository<IdempotencyRecord, UUID> {
    Optional<IdempotencyRecord> findByTenantIdAndActorIdAndOperationAndIdempotencyKey(
            Long tenantId, UUID actorId, String operation, String idempotencyKey);
}
