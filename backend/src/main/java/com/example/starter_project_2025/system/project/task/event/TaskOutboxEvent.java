package com.example.starter_project_2025.system.project.task.event;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "task_outbox_event", uniqueConstraints = @UniqueConstraint(name = "uk_task_outbox_request",
        columnNames = {"actor_id", "request_id"}),
        indexes = @Index(name = "idx_task_outbox_status", columnList = "status"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaskOutboxEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    UUID id;

    @Column(name = "task_id", nullable = false)
    UUID taskId;

    @Column(name = "project_id", nullable = false)
    UUID projectId;

    @Column(name = "actor_id", nullable = false)
    Long actorId;

    @Column(name = "event_type", nullable = false, length = 40)
    String eventType;

    @Column(name = "request_id", nullable = false)
    UUID requestId;

    @Column(name = "request_hash", nullable = false, length = 64)
    String requestHash;

    @Column(name = "correlation_id", nullable = false, length = 100)
    String correlationId;

    @Column(nullable = false, columnDefinition = "TEXT")
    String payload;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    TaskOutboxStatus status = TaskOutboxStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @Column(name = "published_at")
    LocalDateTime publishedAt;
}
