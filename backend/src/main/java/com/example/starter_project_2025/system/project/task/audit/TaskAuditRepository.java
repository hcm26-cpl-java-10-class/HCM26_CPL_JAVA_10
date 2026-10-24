package com.example.starter_project_2025.system.project.task.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TaskAuditRepository extends JpaRepository<TaskAuditLog, UUID> {
    List<TaskAuditLog> findByTaskIdOrderByOccurredAtAsc(UUID taskId);
}
