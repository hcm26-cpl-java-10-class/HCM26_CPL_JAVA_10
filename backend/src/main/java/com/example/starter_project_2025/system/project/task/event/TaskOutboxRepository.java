package com.example.starter_project_2025.system.project.task.event;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TaskOutboxRepository extends JpaRepository<TaskOutboxEvent, UUID> {
    Optional<TaskOutboxEvent> findByActorIdAndRequestId(Long actorId, UUID requestId);
}
