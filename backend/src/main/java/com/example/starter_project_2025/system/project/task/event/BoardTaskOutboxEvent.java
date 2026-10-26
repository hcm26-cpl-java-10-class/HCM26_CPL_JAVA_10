package com.example.starter_project_2025.system.project.task.event;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "board_task_outbox_event",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_board_task_outbox_dedupe",
                columnNames = "dedupe_key"
        ),
        indexes = @Index(name = "idx_board_task_outbox_status", columnList = "status")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BoardTaskOutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "event_id", nullable = false, unique = true, length = 64)
    String eventId;

    @Column(name = "dedupe_key", nullable = false, length = 255)
    String dedupeKey;

    @Column(name = "aggregate_id", nullable = false)
    Long aggregateId;

    @Column(name = "project_id", nullable = false)
    Long projectId;

    @Column(name = "event_type", nullable = false, length = 60)
    String eventType;

    @Column(nullable = false, columnDefinition = "TEXT")
    String payload;

    @Column(name = "correlation_id", nullable = false, length = 100)
    String correlationId;

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
