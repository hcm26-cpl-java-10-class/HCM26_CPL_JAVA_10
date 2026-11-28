package com.example.starter_project_2025.system.project.milestone.outbox;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {
    long countByAggregateId(UUID aggregateId);
    long countByEventType(String eventType);
}
