package com.example.starter_project_2025.system.project.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
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
        name = "project_activity_log",
        indexes = @Index(name = "idx_project_activity_project_time", columnList = "project_id, occurred_at")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "project_id", nullable = false)
    Long projectId;

    @Column(name = "actor_id")
    Long actorId;

    @Column(name = "actor_display_name", length = 200)
    String actorDisplayName;

    @Column(name = "action_type", nullable = false, length = 50)
    String actionType;

    @Column(name = "entity_type", nullable = false, length = 50)
    String entityType;

    @Column(name = "entity_id")
    Long entityId;

    @Column(name = "before_state", columnDefinition = "TEXT")
    String beforeState;

    @Column(name = "after_state", columnDefinition = "TEXT")
    String afterState;

    @Column(name = "correlation_id", length = 100)
    String correlationId;

    @CreationTimestamp
    @Column(name = "occurred_at", nullable = false, updatable = false)
    LocalDateTime occurredAt;
}
