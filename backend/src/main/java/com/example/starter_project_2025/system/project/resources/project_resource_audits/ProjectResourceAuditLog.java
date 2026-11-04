package com.example.starter_project_2025.system.project.resources.project_resource_audits;

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
 * Persistent audit trail of project resource mutations (US-RES-003 AC01).
 * <p>
 * Every row captures the actor, the timestamp, the before/after state and the
 * correlation id of the originating request. The record is written inside the
 * same transaction as the mutation so the two can never diverge.
 */
@Entity
@Table(
        name = "project_resource_audit_log",
        indexes = {
                @Index(name = "idx_project_resource_audit_project", columnList = "project_id"),
                @Index(name = "idx_project_resource_audit_resource", columnList = "resource_id"),
                @Index(name = "idx_project_resource_audit_correlation", columnList = "correlation_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectResourceAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "project_id", nullable = false)
    Long projectId;

    @Column(name = "resource_id")
    Long resourceId;

    @Column(nullable = false, length = 50)
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
