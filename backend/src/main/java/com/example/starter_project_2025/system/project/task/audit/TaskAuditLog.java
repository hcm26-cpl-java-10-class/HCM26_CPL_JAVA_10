package com.example.starter_project_2025.system.project.task.audit;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "task_audit_log", indexes = @Index(name = "idx_task_audit_task", columnList = "task_id"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaskAuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @Column(name = "task_id", nullable = false)
    UUID taskId;

    @Column(name = "project_id", nullable = false)
    UUID projectId;

    @Column(name = "actor_id", nullable = false)
    Long actorId;

    @Column(nullable = false, length = 20)
    String action;

    @Column(name = "before_state", columnDefinition = "TEXT")
    String beforeState;

    @Column(name = "after_state", nullable = false, columnDefinition = "TEXT")
    String afterState;

    @Column(name = "correlation_id", nullable = false, length = 100)
    String correlationId;

    @CreationTimestamp
    @Column(name = "occurred_at", nullable = false, updatable = false)
    LocalDateTime occurredAt;
}
