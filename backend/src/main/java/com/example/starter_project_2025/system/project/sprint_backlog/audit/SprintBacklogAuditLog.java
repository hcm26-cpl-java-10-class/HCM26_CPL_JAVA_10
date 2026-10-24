package com.example.starter_project_2025.system.project.sprint_backlog.audit;

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

/**
 * Persistent audit trail for Sprint Backlog mutations.
 * <p>
 * Every row captures the actor, the timestamp, the before/after state and the
 * correlation id of the originating request (same contract as the sprint
 * module).
 */
@Entity
@Table(
        name = "sprint_backlog_audit_log",
        indexes = {
                @Index(name = "idx_sprint_backlog_audit_item", columnList = "sprint_backlog_id"),
                @Index(name = "idx_sprint_backlog_audit_correlation", columnList = "correlation_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SprintBacklogAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "sprint_backlog_id", nullable = false)
    Long sprintBacklogId;

    @Column(name = "sprint_id")
    Long sprintId;

    @Column(nullable = false, length = 20)
    String action;

    @Column(name = "actor_id")
    Long actorId;

    @Column(name = "actor_email", length = 255)
    String actorEmail;

    @Column(name = "correlation_id", length = 100)
    String correlationId;

    @Column(name = "before_state", columnDefinition = "TEXT")
    String beforeState;

    @Column(name = "after_state", columnDefinition = "TEXT")
    String afterState;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;
}
