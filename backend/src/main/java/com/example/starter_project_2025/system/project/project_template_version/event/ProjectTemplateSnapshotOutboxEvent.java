package com.example.starter_project_2025.system.project.project_template_version.event;

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

/**
 * Transactional outbox row for project template version domain events.
 * <p>
 * The {@code dedupeKey} is unique, which guarantees a domain event is persisted
 * at most once even if the originating use case is retried with the same
 * correlation id (idempotent publishing).
 */
@Entity
@Table(
        name = "project_template_version_outbox_event",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_ptv_outbox_dedupe",
                columnNames = "dedupe_key"
        ),
        indexes = @Index(name = "idx_ptv_outbox_status", columnList = "status")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTemplateSnapshotOutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "event_id", nullable = false, unique = true, length = 64)
    String eventId;

    @Column(name = "dedupe_key", nullable = false, length = 255)
    String dedupeKey;

    @Column(name = "aggregate_type", nullable = false, length = 50)
    String aggregateType;

    @Column(name = "aggregate_id", nullable = false)
    Long aggregateId;

    @Column(name = "event_type", nullable = false, length = 60)
    String eventType;

    @Column(nullable = false, columnDefinition = "TEXT")
    String payload;

    @Column(name = "correlation_id", length = 100)
    String correlationId;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    ProjectTemplateSnapshotOutboxStatus status = ProjectTemplateSnapshotOutboxStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @Column(name = "published_at")
    LocalDateTime publishedAt;
}
