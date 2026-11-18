package com.example.starter_project_2025.system.project.task.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TaskAuditRepository extends JpaRepository<TaskAuditLog, UUID> {
    interface LatestContribution { Long getActorId(); java.time.LocalDateTime getOccurredAt(); }

    @org.springframework.data.jpa.repository.Query("select a.actorId as actorId, max(a.occurredAt) as occurredAt from TaskAuditLog a where a.projectId=:projectId and a.actorId in :actorIds and a.action in :actions and a.occurredAt<=:now group by a.actorId")
    List<LatestContribution> latestContributions(@org.springframework.data.repository.query.Param("projectId") UUID projectId,
            @org.springframework.data.repository.query.Param("actorIds") java.util.Collection<Long> actorIds,
            @org.springframework.data.repository.query.Param("actions") java.util.Collection<String> actions,
            @org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);
    List<TaskAuditLog> findByTaskIdOrderByOccurredAtAsc(UUID taskId);
}
